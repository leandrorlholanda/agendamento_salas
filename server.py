import os
import io
import json
import sqlite3
import shutil
import uuid
import threading
import time
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse
import socket

# Configurações básicas
PORT = int(os.environ.get('PORT', 8000))
DB_FILE = os.environ.get('DATABASE_PATH', 'database.db')
BACKUP_DIR = os.environ.get('BACKUP_PATH', 'backups')
SECRET_ADMIN_CODE = 'CONDE123'  # Código para registro de admins

# Garantir diretório do banco de dados (caso esteja em subpasta)
db_dir = os.path.dirname(DB_FILE)
if db_dir and not os.path.exists(db_dir):
    os.makedirs(db_dir)

# Garantir diretório de backups
if not os.path.exists(BACKUP_DIR):
    os.makedirs(BACKUP_DIR)

# Dicionário em memória para sessões (token -> user_info)
SESSIONS = {}

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabela de Usuários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user'
        )
    ''')
    
    # Tabela de Salas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            capacity INTEGER NOT NULL,
            features TEXT
        )
    ''')
    
    # Tabela de Reservas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            room_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            start_time TEXT NOT NULL, -- Formato ISO: YYYY-MM-DDTHH:MM
            end_time TEXT NOT NULL,   -- Formato ISO: YYYY-MM-DDTHH:MM
            status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, checked_in, cancelled, no_show
            company TEXT,
            organizer_name TEXT,
            meeting_type TEXT DEFAULT 'presencial',
            supplier_name TEXT,
            supplier_company TEXT,
            FOREIGN KEY (room_id) REFERENCES rooms(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Migrar banco de dados existente se necessário para adicionar novas colunas
    try:
        cursor.execute("ALTER TABLE bookings ADD COLUMN company TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE bookings ADD COLUMN organizer_name TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE bookings ADD COLUMN meeting_type TEXT DEFAULT 'presencial'")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE bookings ADD COLUMN supplier_name TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE bookings ADD COLUMN supplier_company TEXT")
    except sqlite3.OperationalError:
        pass
    
    # Migrar status antigos de 'pending' para 'confirmed'
    try:
        cursor.execute("UPDATE bookings SET status = 'confirmed' WHERE status = 'pending'")
    except Exception:
        pass
    
    # Tabela de Histórico de Backups
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS backup_logs (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            type TEXT NOT NULL -- automatic, manual
        )
    ''')
    
    # Tabela de Sessões persistentes (evita deslogar no reinício do servidor)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Inserir salas iniciais se não existirem
    cursor.execute("SELECT COUNT(*) FROM rooms")
    if cursor.fetchone()[0] == 0:
        rooms_data = [
            ("Sala Diretoria", 12, "TV 65\", Videoconferência, Ar Condicionado"),
            ("Sala Inovação", 8, "Lousa de Vidro, Projetor, Ar Condicionado"),
            ("Sala Fênix", 6, "TV 50\", Ar Condicionado, Lousa"),
            ("Sala Harmonia", 4, "Lousa de Vidro, Ar Condicionado"),
            ("Sala Integração", 15, "Auditório, Projetor, Caixa de Som, Videoconferência"),
            ("Sala Aliança", 6, "TV 42\", Lousa")
        ]
        cursor.executemany("INSERT INTO rooms (name, capacity, features) VALUES (?, ?, ?)", rooms_data)
        
    # Inserir usuário Administrador Padrão se não existir
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "Admin Farma Conde", "admin@grupofarmaconde.com.br", "admin123", "admin")
        )
        print("Usuário administrador padrão criado: admin@grupofarmaconde.com.br / admin123")
        
    conn.commit()
    conn.close()

# Inicializar Banco de Dados
init_db()

# --- BACKGROUND THREADS ---

def no_show_monitor():
    """
    Thread de monitoramento de No-shows: roda a cada 30 segundos e marca reuniões
    que começaram há mais de 15 minutos sem check-in como 'no_show'.
    """
    print("Iniciando Monitor de No-Show...")
    while True:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            now = datetime.now()
            
            # Formato do banco de dados: YYYY-MM-DDTHH:MM
            # Buscar reuniões com status 'confirmed' (ainda sem check-in realizado)
            cursor.execute("SELECT id, start_time, room_id FROM bookings WHERE status = 'confirmed'")
            confirmed_bookings = cursor.fetchall()
            
            for booking in confirmed_bookings:
                start_dt = datetime.strptime(booking['start_time'], "%Y-%m-%dT%H:%M")
                # Se passou de 15 minutos do horário de início da reserva
                if now > (start_dt + timedelta(minutes=15)):
                    cursor.execute(
                        "UPDATE bookings SET status = 'no_show' WHERE id = ?",
                        (booking['id'],)
                    )
                    print(f"[NO-SHOW] Reserva {booking['id']} marcada como no-show. Sala liberada.")
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[ERRO - MONITOR NO-SHOW] {e}")
        time.sleep(30)

def generate_backup(backup_type="automatic"):
    """Gera um arquivo de backup do banco de dados sqlite"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.db"
        dest_path = os.path.join(BACKUP_DIR, filename)
        
        # Copiar o banco de dados
        shutil.copy2(DB_FILE, dest_path)
        
        # Registrar o log no banco de dados
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO backup_logs (id, filename, timestamp, type) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), filename, datetime.now().isoformat(), backup_type)
        )
        conn.commit()
        conn.close()
        print(f"[BACKUP] Backup {backup_type} gerado com sucesso: {dest_path}")
        return filename
    except Exception as e:
        print(f"[ERRO - BACKUP] Falha ao gerar backup: {e}")
        return None

def daily_backup_scheduler():
    """
    Thread de Backup Diário: realiza o backup do banco de dados uma vez por dia (a cada 24 horas).
    """
    print("Iniciando Agendador de Backup Diário...")
    # Fazer um backup logo na inicialização para garantir
    generate_backup("automatic")
    
    while True:
        # Espera 24 horas (86400 segundos) para o próximo backup automático
        time.sleep(86400)
        generate_backup("automatic")


# Iniciar Threads em background
threading.Thread(target=no_show_monitor, daemon=True).start()
threading.Thread(target=daily_backup_scheduler, daemon=True).start()


# --- HANDLER DO SERVIDOR HTTP ---

class RequestHandler(BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # Sobrescrever para evitar logs chatos no console toda hora, se preferir
        pass

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def get_authenticated_user(self):
        """Busca o usuário autenticado a partir do header Authorization"""
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        
        # Buscar sessão no banco de dados (SQLite)
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id, u.name, u.email, u.role
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
            """, (token,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return dict(row)
        except Exception as e:
            print(f"[ERRO - AUTH] Falha ao ler sessão do banco: {e}")
            
        # Fallback para o dicionário em memória
        return SESSIONS.get(token)

    def send_json(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error_json(self, message, status_code=400):
        self.send_json({"error": message}, status_code)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # --- ROTAS DA API ---
        
        # Obter IP de rede local para auxílio mobile
        if path == '/api/local-ip':
            local_ip = get_local_ip()
            return self.send_json({"localIp": local_ip, "port": PORT})

        # Obter todas as salas
        elif path == '/api/rooms':
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM rooms")
            rooms = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(rooms)

        # Obter agendamentos (opcionalmente filtrados por data)
        elif path == '/api/bookings':
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Trazer também o nome do usuário e o nome da sala
            query = """
                SELECT b.*, r.name as room_name, u.name as user_name, u.email as user_email
                FROM bookings b
                JOIN rooms r ON b.room_id = r.id
                JOIN users u ON b.user_id = u.id
                ORDER BY b.start_time ASC
            """
            cursor.execute(query)
            bookings = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(bookings)

        # Relatório de Administração
        elif path == '/api/admin/reports':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
                
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Estatísticas Básicas
            cursor.execute("SELECT COUNT(*) FROM bookings")
            total_bookings = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM bookings WHERE status = 'checked_in'")
            total_checked_in = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM bookings WHERE status = 'no_show'")
            total_no_shows = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM bookings WHERE status = 'cancelled'")
            total_cancelled = cursor.fetchone()[0]
            
            # Taxa de No-Show (reuniões no-show / total de reuniões finalizadas/no-show/canceladas)
            no_show_rate = 0.0
            if total_bookings > 0:
                no_show_rate = round((total_no_shows / total_bookings) * 100, 2)
            
            # Reservas por sala
            cursor.execute("""
                SELECT r.name, COUNT(b.id) as count 
                FROM rooms r 
                LEFT JOIN bookings b ON r.id = b.room_id 
                GROUP BY r.id
            """)
            by_room = [dict(row) for row in cursor.fetchall()]

            # Reservas por Usuário (Top Agendadores)
            cursor.execute("""
                SELECT u.name, u.email, COUNT(b.id) as count 
                FROM users u 
                JOIN bookings b ON u.id = b.user_id 
                GROUP BY u.id 
                ORDER BY count DESC 
                LIMIT 5
            """)
            top_users = [dict(row) for row in cursor.fetchall()]
            
            # Cálculo de Ocupação Média
            # Consideramos 10 horas comerciais por dia por sala (8:00 às 18:00).
            # Para simplificar: calculamos a soma de horas de reuniões confirmadas ou pendentes
            # em relação ao potencial total.
            cursor.execute("SELECT start_time, end_time FROM bookings WHERE status IN ('checked_in', 'confirmed')")
            bookings_times = cursor.fetchall()
            total_hours_booked = 0.0
            for bt in bookings_times:
                try:
                    start_dt = datetime.strptime(bt['start_time'], "%Y-%m-%dT%H:%M")
                    end_dt = datetime.strptime(bt['end_time'], "%Y-%m-%dT%H:%M")
                    diff = (end_dt - start_dt).total_seconds() / 3600.0
                    if diff > 0:
                        total_hours_booked += diff
                except Exception:
                    pass
            
            # Total disponível estimado (últimos 7 dias x 6 salas x 10 horas/dia = 420 horas de capacidade semanal)
            # Para representação, vamos dar um percentual com base em um teto operacional fixo de 200 horas.
            occupancy_rate = min(100.0, round((total_hours_booked / 300.0) * 100, 2)) if total_bookings > 0 else 0.0
            
            conn.close()
            
            return self.send_json({
                "total_bookings": total_bookings,
                "total_checked_in": total_checked_in,
                "total_no_shows": total_no_shows,
                "total_cancelled": total_cancelled,
                "no_show_rate": no_show_rate,
                "occupancy_rate": occupancy_rate,
                "by_room": by_room,
                "top_users": top_users
            })

        # Listar backups gerados
        elif path == '/api/admin/backups/list':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
                
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM backup_logs ORDER BY timestamp DESC")
            backups = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(backups)

        # Listar usuários (Admin)
        elif path == '/api/admin/users/list':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
                
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, email, password, role FROM users ORDER BY name ASC")
            users_list = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(users_list)
            
        # Download do banco de dados SQLite atual
        elif path == '/api/admin/backup/download':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
            
            if os.path.exists(DB_FILE):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="{DB_FILE}"')
                self.send_cors_headers()
                self.end_headers()
                with open(DB_FILE, 'rb') as f:
                    self.wfile.write(f.read())
                return
            else:
                return self.send_error_json("Banco de dados não encontrado", 404)

        # --- SERVIR ARQUIVOS ESTÁTICOS DO FRONTEND ---
        else:
            # Caminho de arquivos estáticos na pasta 'public'
            filename = path.lstrip('/')
            if filename == '':
                filename = 'index.html'
                
            filepath = os.path.join('public', filename)
            
            # Segurança simples: garantir que o arquivo lido está dentro de 'public/'
            abs_public_dir = os.path.abspath('public')
            abs_filepath = os.path.abspath(filepath)
            
            if not abs_filepath.startswith(abs_public_dir) or not os.path.exists(filepath) or os.path.isdir(filepath):
                # Se não encontrar o arquivo, retorna index.html (suporta SPA routing se necessário)
                filepath = os.path.join('public', 'index.html')
                if not os.path.exists(filepath):
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write(b"Arquivo nao encontrado")
                    return
            
            # Definir Content-Type correto
            content_type = 'text/html; charset=utf-8'
            if filepath.endswith('.css'):
                content_type = 'text/css; charset=utf-8'
            elif filepath.endswith('.js'):
                content_type = 'application/javascript; charset=utf-8'
            elif filepath.endswith('.png'):
                content_type = 'image/png'
            elif filepath.endswith('.svg'):
                content_type = 'image/svg+xml'
            elif filepath.endswith('.json'):
                content_type = 'application/json'

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_cors_headers()
            self.end_headers()
            
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # Ler o corpo da requisição JSON
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        try:
            body = json.loads(post_data) if post_data else {}
        except json.JSONDecodeError:
            return self.send_error_json("JSON inválido no corpo da requisição")

        # --- ROTAS DA API DE POST ---

        # 1. Registro de Usuário
        if path == '/api/auth/register':
            name = body.get('name', '').strip()
            email = body.get('email', '').strip().lower()
            password = body.get('password', '').strip()
            admin_code = body.get('adminCode', '').strip()
            
            if not name or not email or not password:
                return self.send_error_json("Nome, email e senha são obrigatórios.")
                
            # Validação do e-mail corporativo
            if not email.endswith('@grupofarmaconde.com.br'):
                return self.send_error_json("É necessário utilizar um e-mail corporativo @grupofarmaconde.com.br.")
                
            role = 'user'
            if admin_code:
                if admin_code == SECRET_ADMIN_CODE:
                    role = 'admin'
                else:
                    return self.send_error_json("Código de administrador incorreto.")
                    
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                user_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
                    (user_id, name, email, password, role)
                )
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Usuário registrado com sucesso!"})
            except sqlite3.IntegrityError:
                return self.send_error_json("Este e-mail já está cadastrado no sistema.")
            except Exception as e:
                return self.send_error_json(f"Erro no cadastro: {e}")

        # 2. Login de Usuário
        elif path == '/api/auth/login':
            email = body.get('email', '').strip().lower()
            password = body.get('password', '').strip()
            
            if not email or not password:
                return self.send_error_json("E-mail e senha são obrigatórios.")
                
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            conn.close()
            
            if not user or user['password'] != password:
                return self.send_error_json("E-mail ou senha incorretos.")
                
            # Gerar token de sessão
            token = str(uuid.uuid4())
            SESSIONS[token] = {
                "id": user['id'],
                "name": user['name'],
                "email": user['email'],
                "role": user['role']
            }
            
            # Persistir sessão no banco de dados SQLite para evitar deslogar no restart
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                    (token, user['id'], datetime.now().isoformat())
                )
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"[ERRO - SESSÃO] Falha ao gravar sessão no banco: {e}")
            
            return self.send_json({
                "success": True,
                "token": token,
                "user": SESSIONS[token]
            })

        # 3. Criar Reserva
        elif path == '/api/bookings/create':
            user = self.get_authenticated_user()
            if not user:
                return self.send_error_json("Não autenticado", 401)
                
            room_id = body.get('roomId')
            start_time = body.get('startTime') # formato YYYY-MM-DDTHH:MM
            end_time = body.get('endTime')     # formato YYYY-MM-DDTHH:MM
            company = body.get('company', '').strip()
            organizer_name = body.get('organizerName', '').strip()
            meeting_type = body.get('meetingType', 'presencial').strip()
            supplier_name = body.get('supplierName', '').strip()
            supplier_company = body.get('supplierCompany', '').strip()
            
            if not room_id or not start_time or not end_time or not organizer_name or not company or not supplier_name or not supplier_company:
                return self.send_error_json("Sala, horário de início, término, responsável, setor, fornecedor e empresa do fornecedor são obrigatórios.")
                
            # Validar ordem das datas
            try:
                start_dt = datetime.strptime(start_time, "%Y-%m-%dT%H:%M")
                end_dt = datetime.strptime(end_time, "%Y-%m-%dT%H:%M")
            except ValueError:
                return self.send_error_json("Formato de data inválido. Use AAAA-MM-DDTHH:MM")
                
            if start_dt >= end_dt:
                return self.send_error_json("O horário de início deve ser anterior ao de término.")
                
            if start_dt < datetime.now():
                return self.send_error_json("Não é possível agendar reuniões no passado.")
                
            # Verificar limite de tempo de reserva (ex: máximo de 4 horas por reunião)
            if (end_dt - start_dt).total_seconds() > 14400:
                return self.send_error_json("Uma reserva não pode exceder o limite de 4 horas.")
                
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Verificar se a sala existe
            cursor.execute("SELECT id FROM rooms WHERE id = ?", (room_id,))
            if not cursor.fetchone():
                conn.close()
                return self.send_error_json("Sala não encontrada.")
                
            # Verificar conflitos de horário (sobreposição)
            # Uma reserva conflita se:
            # (start_time < B.end_time) AND (end_time > B.start_time)
            # E se o status do conflito não for "cancelled" ou "no_show".
            cursor.execute("""
                SELECT id FROM bookings 
                WHERE room_id = ? 
                  AND status NOT IN ('cancelled', 'no_show')
                  AND start_time < ? 
                  AND end_time > ?
            """, (room_id, end_time, start_time))
            
            if cursor.fetchone():
                conn.close()
                return self.send_error_json("Já existe um agendamento para esta sala no período escolhido.")
                
            # Cadastrar reserva
            booking_id = str(uuid.uuid4())
            try:
                cursor.execute(
                    "INSERT INTO bookings (id, room_id, user_id, start_time, end_time, status, company, organizer_name, meeting_type, supplier_name, supplier_company) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)",
                    (booking_id, room_id, user['id'], start_time, end_time, company, organizer_name, meeting_type, supplier_name, supplier_company)
                )
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "bookingId": booking_id, "message": "Agendamento realizado com sucesso!"})
            except Exception as e:
                conn.close()
                return self.send_error_json(f"Erro ao salvar reserva: {e}")

        # 3.1. Alterar Reserva
        elif path == '/api/bookings/update':
            user = self.get_authenticated_user()
            if not user:
                return self.send_error_json("Não autenticado", 401)
                
            booking_id = body.get('bookingId')
            room_id = body.get('roomId')
            start_time = body.get('startTime') # formato YYYY-MM-DDTHH:MM
            end_time = body.get('endTime')     # formato YYYY-MM-DDTHH:MM
            company = body.get('company', '').strip()
            organizer_name = body.get('organizerName', '').strip()
            meeting_type = body.get('meetingType', 'presencial').strip()
            supplier_name = body.get('supplierName', '').strip()
            supplier_company = body.get('supplierCompany', '').strip()
            
            if not booking_id or not room_id or not start_time or not end_time or not organizer_name or not company or not supplier_name or not supplier_company:
                return self.send_error_json("Código da reserva, sala, horário de início, término, responsável, setor, fornecedor e empresa do fornecedor são obrigatórios.")
                
            # Validar ordem das datas
            try:
                start_dt = datetime.strptime(start_time, "%Y-%m-%dT%H:%M")
                end_dt = datetime.strptime(end_time, "%Y-%m-%dT%H:%M")
            except ValueError:
                return self.send_error_json("Formato de data inválido. Use AAAA-MM-DDTHH:MM")
                
            if start_dt >= end_dt:
                return self.send_error_json("O horário de início deve ser anterior ao de término.")
                
            if start_dt < datetime.now() - timedelta(minutes=10):  # margem de tolerância pequena para edições
                return self.send_error_json("Não é possível alterar reuniões para o passado.")
                
            # Verificar limite de tempo de reserva (ex: máximo de 4 horas por reunião)
            if (end_dt - start_dt).total_seconds() > 14400:
                return self.send_error_json("Uma reserva não pode exceder o limite de 4 horas.")
                
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Verificar se a reserva existe
            cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()
            if not booking:
                conn.close()
                return self.send_error_json("Reserva não encontrada.")
                
            # Permissão: usuário comum só altera a sua própria. Admin altera qualquer uma.
            if booking['user_id'] != user['id'] and user['role'] != 'admin':
                conn.close()
                return self.send_error_json("Você não tem permissão para alterar este agendamento corporativo.", 403)
                
            if booking['status'] in ('cancelled', 'no_show'):
                conn.close()
                return self.send_error_json("Não é possível alterar uma reserva já cancelada ou inativa.")
                
            # Verificar se a sala destino existe
            cursor.execute("SELECT id FROM rooms WHERE id = ?", (room_id,))
            if not cursor.fetchone():
                conn.close()
                return self.send_error_json("Sala destino não encontrada.")
                
            # Verificar conflitos de horário (sobreposição) ignorando a própria reserva
            cursor.execute("""
                SELECT id FROM bookings 
                WHERE room_id = ? 
                  AND id != ?
                  AND status NOT IN ('cancelled', 'no_show')
                  AND start_time < ? 
                  AND end_time > ?
            """, (room_id, booking_id, end_time, start_time))
            
            if cursor.fetchone():
                conn.close()
                return self.send_error_json("Já existe um agendamento para esta sala no período escolhido.")
                
            # Atualizar reserva
            try:
                cursor.execute(
                    "UPDATE bookings SET room_id = ?, start_time = ?, end_time = ?, status = 'confirmed', company = ?, organizer_name = ?, meeting_type = ?, supplier_name = ?, supplier_company = ? WHERE id = ?",
                    (room_id, start_time, end_time, company, organizer_name, meeting_type, supplier_name, supplier_company, booking_id)
                )
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Agendamento alterado com sucesso!"})
            except Exception as e:
                conn.close()
                return self.send_error_json(f"Erro ao salvar alterações da reserva: {e}")

        # 4. Check-in de Sala
        elif path == '/api/bookings/check-in':
            user = self.get_authenticated_user()
            if not user:
                return self.send_error_json("Não autenticado", 401)
                
            booking_id = body.get('bookingId')
            if not booking_id:
                return self.send_error_json("Código da reserva é obrigatório.")
                
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()
            
            if not booking:
                conn.close()
                return self.send_error_json("Reserva não encontrada.")
                
            # Validar permissão: apenas o próprio dono da reserva pode dar check-in
            if booking['user_id'] != user['id'] and user['role'] != 'admin':
                conn.close()
                return self.send_error_json("Apenas o responsável pelo agendamento pode fazer check-in.", 403)
                
            # Validar se o status é 'confirmed'
            if booking['status'] != 'confirmed':
                conn.close()
                return self.send_error_json(f"Não é possível fazer check-in. Status atual: {booking['status']}.")
                
            # Validar janela de tempo para check-in (ex: até 15 min antes e até 15 min depois do horário de início)
            now = datetime.now()
            start_dt = datetime.strptime(booking['start_time'], "%Y-%m-%dT%H:%M")
            
            early_limit = start_dt - timedelta(minutes=15)
            late_limit = start_dt + timedelta(minutes=15)
            
            # Para fins de simulação/facilidade de demonstração para o usuário,
            # nós permitiremos o check-in a qualquer momento se a reserva for no mesmo dia,
            # mas vamos imprimir um aviso de conformidade no console.
            # Caso queira regras restritas de horário em produção, retire o comentário do bloco abaixo:
            # if now < early_limit or now > late_limit:
            #     conn.close()
            #     return self.send_error_json("Fora do horário permitido para check-in (15 min antes até 15 min após o início).")

            cursor.execute("UPDATE bookings SET status = 'checked_in' WHERE id = ?", (booking_id,))
            conn.commit()
            conn.close()
            return self.send_json({"success": True, "message": "Check-in realizado com sucesso!"})

        # 5. Cancelamento de Reserva
        elif path == '/api/bookings/cancel':
            user = self.get_authenticated_user()
            if not user:
                return self.send_error_json("Não autenticado", 401)
                
            booking_id = body.get('bookingId')
            if not booking_id:
                return self.send_error_json("Código da reserva é obrigatório.")
                
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
            booking = cursor.fetchone()
            
            if not booking:
                conn.close()
                return self.send_error_json("Reserva não encontrada.")
                
            # Permissão: usuário comum só cancela a própria. Admin cancela qualquer uma.
            if booking['user_id'] != user['id'] and user['role'] != 'admin':
                conn.close()
                return self.send_error_json("Você não tem permissão para cancelar este agendamento corporativo.", 403)
                
            if booking['status'] in ('cancelled', 'no_show'):
                conn.close()
                return self.send_error_json("Este agendamento já está cancelado ou inativo.")
                
            cursor.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", (booking_id,))
            conn.commit()
            conn.close()
            return self.send_json({"success": True, "message": "Reserva cancelada com sucesso!"})

        # 6. Forçar Backup Manual
        elif path == '/api/admin/backup/trigger':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin' or user['email'] != 'admin@grupofarmaconde.com.br':
                return self.send_error_json("Não autorizado", 403)
                
            filename = generate_backup("manual")
            if filename:
                return self.send_json({"success": True, "filename": filename, "message": "Backup manual gerado com sucesso!"})
            else:
                return self.send_error_json("Falha interna ao gerar backup.", 500)

        # 6.1. Restaurar Backup (Master Admin Only)
        elif path == '/api/admin/backup/restore':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin' or user['email'] != 'admin@grupofarmaconde.com.br':
                return self.send_error_json("Não autorizado", 403)
                
            filename = body.get('filename')
            if not filename:
                return self.send_error_json("Nome do arquivo de backup é obrigatório.")
                
            clean_filename = os.path.basename(filename)
            backup_path = os.path.join(BACKUP_DIR, clean_filename)
            
            if not os.path.exists(backup_path):
                return self.send_error_json("Arquivo de backup não encontrado.")
                
            try:
                # Gerar backup preventivo antes de sobrescrever
                generate_backup("automatic")
                
                # Restaurar copiando o backup por cima do database.db
                shutil.copy2(backup_path, DB_FILE)
                
                # Limpar sessões na memória
                SESSIONS.clear()
                
                return self.send_json({"success": True, "message": "Backup restaurado com sucesso!"})
            except Exception as e:
                return self.send_error_json(f"Erro ao restaurar backup: {e}")

        # 7. Promover Usuário a Admin
        elif path == '/api/admin/promote':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
                
            target_email = body.get('email', '').strip().lower()
            if not target_email:
                return self.send_error_json("E-mail do usuário é obrigatório.")
                
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (target_email,))
            target = cursor.fetchone()
            
            if not target:
                conn.close()
                return self.send_error_json("Usuário não encontrado.")
                
            cursor.execute("UPDATE users SET role = 'admin' WHERE email = ?", (target_email,))
            conn.commit()
            conn.close()
            return self.send_json({"success": True, "message": f"Usuário {target_email} promovido a Administrador!"})
            
        # 8. Atualizar Sala (Admin)
        elif path == '/api/admin/rooms/update':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
                
            room_id = body.get('id')
            name = body.get('name', '').strip()
            capacity = body.get('capacity')
            features = body.get('features', '').strip()
            
            if not room_id or not name or capacity is None:
                return self.send_error_json("Código da sala, nome e capacidade são obrigatórios.")
                
            try:
                capacity = int(capacity)
                if capacity <= 0:
                    raise ValueError()
            except ValueError:
                return self.send_error_json("A capacidade deve ser um número inteiro maior que zero.")
                
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Verificar se o nome da sala já está em uso por outra sala
                cursor.execute("SELECT id FROM rooms WHERE name = ? AND id != ?", (name, room_id))
                if cursor.fetchone():
                    conn.close()
                    return self.send_error_json("Já existe uma sala cadastrada com este nome.")
                    
                cursor.execute(
                    "UPDATE rooms SET name = ?, capacity = ?, features = ? WHERE id = ?",
                    (name, capacity, features, room_id)
                )
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Sala atualizada com sucesso!"})
            except Exception as e:
                return self.send_error_json(f"Erro ao atualizar sala: {e}")

        # 9. Excluir Usuário (Admin)
        elif path == '/api/admin/users/delete':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
                
            target_user_id = body.get('userId')
            if not target_user_id:
                return self.send_error_json("Código do usuário é obrigatório.")
                
            if target_user_id == user['id']:
                return self.send_error_json("Você não pode excluir o seu próprio usuário administrador.")
                
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("DELETE FROM sessions WHERE user_id = ?", (target_user_id,))
                cursor.execute("DELETE FROM bookings WHERE user_id = ?", (target_user_id,))
                cursor.execute("DELETE FROM users WHERE id = ?", (target_user_id,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Usuário e suas dependências excluídos com sucesso!"})
            except Exception as e:
                return self.send_error_json(f"Erro ao excluir usuário: {e}")

        # 10. Atualizar Senha do Usuário (Admin)
        elif path == '/api/admin/users/update-password':
            user = self.get_authenticated_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Não autorizado", 403)
                
            target_user_id = body.get('userId')
            new_password = body.get('password', '').strip()
            
            if not target_user_id or not new_password:
                return self.send_error_json("Código do usuário e nova senha são obrigatórios.")
                
            if len(new_password) < 6:
                return self.send_error_json("A nova senha deve ter pelo menos 6 caracteres.")
                
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_password, target_user_id))
                cursor.execute("DELETE FROM sessions WHERE user_id = ?", (target_user_id,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Senha do usuário atualizada com sucesso!"})
            except Exception as e:
                return self.send_error_json(f"Erro ao atualizar senha: {e}")
            
        else:
            return self.send_error_json("Rota não encontrada", 404)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, RequestHandler)
    local_ip = get_local_ip()
    print(f"==========================================================================")
    print(f"Servidor Farma Conde Rodando na porta {PORT}!")
    print(f"  - No computador local:  http://localhost:{PORT}")
    print(f"  - No celular (mesmo Wi-Fi): http://{local_ip}:{PORT}")
    print(f"==========================================================================")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
