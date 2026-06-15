// ==========================================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================================================
let API_URL = ''; // Rotas relativas ao mesmo servidor
let token = localStorage.getItem('token') || null;
let currentUser = null;
try {
    currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
} catch (e) {
    currentUser = null;
}

let rooms = [];
let bookings = [];
let selectedDate = new Date().toISOString().split('T')[0]; // Data selecionada no formato YYYY-MM-DD

// Captura e redirecionamento de QR Code (Escaneado da porta da sala)
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room') || urlParams.get('sala');
if (roomParam) {
    sessionStorage.setItem('scanRoomId', roomParam);
    // Limpa o parâmetro da URL sem recarregar a página para deixar a URL limpa
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
}

// Estado do Calendário Semanal
let weeklyRoomId = null;
let weeklyStartDate = null; // Objeto Date representando a segunda-feira da semana visualizada

// ==========================================================================
// SELETORES DOM PRINCIPAIS
// ==========================================================================
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const goToRegisterLink = document.getElementById('go-to-register');
const goToLoginLink = document.getElementById('go-to-login');
const registerIsAdminCheckbox = document.getElementById('register-is-admin');
const adminCodeGroup = document.getElementById('admin-code-group');
const registerAdminCodeInput = document.getElementById('register-admin-code');

const sidebarMenuItems = document.querySelectorAll('.menu-item');
const contentSections = document.querySelectorAll('.content-section');
const profileName = document.getElementById('profile-name');
const profileRole = document.getElementById('profile-role');
const profileAvatarInitials = document.getElementById('user-avatar-initials');
const logoutBtn = document.getElementById('logout-btn');

const dashboardDateInput = document.getElementById('dashboard-date');
const prevDayBtn = document.getElementById('prev-day-btn');
const nextDayBtn = document.getElementById('next-day-btn');
const todayBtn = document.getElementById('today-btn');
const roomsGrid = document.getElementById('rooms-grid');

const myBookingsBadge = document.getElementById('my-bookings-badge');
const myBookingsTable = document.getElementById('my-bookings-table');
const myBookingsList = document.getElementById('my-bookings-list');
const noBookingsMsg = document.getElementById('no-bookings-msg');

const newBookingBtn = document.getElementById('new-booking-btn');
const bookingModal = document.getElementById('booking-modal');
const bookingForm = document.getElementById('booking-form');
const bookingRoomSelect = document.getElementById('booking-room');
const bookingOrganizerInput = document.getElementById('booking-organizer');
const bookingCompanyInput = document.getElementById('booking-company');
const bookingSupplierNameInput = document.getElementById('booking-supplier-name');
const bookingSupplierCompanyInput = document.getElementById('booking-supplier-company');
const bookingMeetingTypeSelect = document.getElementById('booking-meeting-type');

// Sincronizar botões de tipo de reunião com o input oculto
if (bookingMeetingTypeSelect) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(bookingMeetingTypeSelect, 'value', {
        get: function() {
            return descriptor.get.call(this);
        },
        set: function(val) {
            descriptor.set.call(this, val);
            document.querySelectorAll('.meeting-type-btn').forEach(btn => {
                if (btn.getAttribute('data-value') === val) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    });
}

// Evento de clique para os botões do seletor
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.meeting-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-value');
            bookingMeetingTypeSelect.value = val;
        });
    });
});

const bookingDateInput = document.getElementById('booking-date');
const closeModalBtns = document.querySelectorAll('.close-modal-btn');

// Elementos Admin
const metricTotalBookings = document.getElementById('metric-total-bookings');
const metricCheckedIn = document.getElementById('metric-checked-in');
const metricNoShowRate = document.getElementById('metric-no-show-rate');
const metricOccupancyRate = document.getElementById('metric-occupancy-rate');
const roomsChartContainer = document.getElementById('rooms-chart-container');
const promoteAdminForm = document.getElementById('promote-admin-form');
const promoteEmailInput = document.getElementById('promote-email');
const triggerBackupBtn = document.getElementById('trigger-backup-btn');
const backupsList = document.getElementById('backups-list');

// Elementos de Gestão de Usuários (Admin)
const adminUsersList = document.getElementById('admin-users-list');
const userPasswordModal = document.getElementById('user-password-modal');
const userPasswordForm = document.getElementById('user-password-form');
const editUserIdInput = document.getElementById('edit-user-id');
const editUserNameInput = document.getElementById('edit-user-name');
const editUserPasswordInput = document.getElementById('edit-user-password');
const closeUserModalBtns = document.querySelectorAll('.close-user-modal-btn');

// Seletores para Edição de Salas
const adminRoomsList = document.getElementById('admin-rooms-list');
const roomModal = document.getElementById('room-modal');
const roomForm = document.getElementById('room-form');
const editRoomIdInput = document.getElementById('edit-room-id');
const editRoomNameInput = document.getElementById('edit-room-name');
const editRoomCapacityInput = document.getElementById('edit-room-capacity');
const editRoomFeaturesInput = document.getElementById('edit-room-features');
const closeRoomModalBtns = document.querySelectorAll('.close-room-modal-btn');

// Seletores para Edição/Visualização de Agendamentos
const bookingIdInput = document.getElementById('booking-id');
const bookingModalTitle = document.getElementById('booking-modal-title');
const adminBookingsList = document.getElementById('admin-bookings-list');

// Seletores para Calendário Semanal
const weeklyModal = document.getElementById('weekly-modal');
const weeklyModalTitle = document.getElementById('weekly-modal-title');
const weeklyCalendarGrid = document.getElementById('weekly-calendar-grid');
const weeklyRangeLabel = document.getElementById('weekly-range-label');
const prevWeekBtn = document.getElementById('prev-week-btn');
const nextWeekBtn = document.getElementById('next-week-btn');
const currentWeekBtn = document.getElementById('current-week-btn');
const closeWeeklyModalBtns = document.querySelectorAll('.close-weekly-modal-btn');
const printWeeklyBtn = document.getElementById('print-weekly-btn');

// Seletores para QR Code e Versão Mobile
const qrcodeModal = document.getElementById('qrcode-modal');
const closeQrcodeModalBtns = document.querySelectorAll('.close-qrcode-modal-btn');
const printQrcodeBtn = document.getElementById('print-qrcode-btn');
const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
const mobileFabBtn = document.getElementById('mobile-fab-btn');
const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
const mobileMyBookingsBadge = document.getElementById('mobile-my-bookings-badge');
const mobileUserInitials = document.getElementById('mobile-user-initials');


// ==========================================================================
// TOAST NOTIFICATIONS (ALERTAS FLUTUANTES)
// ==========================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'warning') iconName = 'alert-circle';
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    // Auto remover após 4 segundos
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// ==========================================================================
// REQUISIÇÕES DA API COM SUPORTE A TOKEN DE AUTENTICAÇÃO
// ==========================================================================
async function apiFetch(path, options = {}) {
    const url = `${API_URL}${path}`;
    
    // Injetar cabeçalhos padrão e de autorização
    options.headers = options.headers || {};
    options.headers['Content-Type'] = 'application/json';
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, options);
        
        // Se a sessão expirou no servidor
        if (response.status === 401) {
            handleLogout();
            showToast('Sessão expirada. Faça login novamente.', 'warning');
            return null;
        }
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição.');
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        return null;
    }
}

// ==========================================================================
// CONTROLE DE NAVEGAÇÃO E SESSÃO (SPA)
// ==========================================================================
function bootApp() {
    if (token && currentUser) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Renderizar perfil na sidebar
        profileName.textContent = currentUser.name;
        profileRole.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Colaborador';
        
        // Iniciais no avatar
        const initials = currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        profileAvatarInitials.textContent = initials;
        if (mobileUserInitials) mobileUserInitials.textContent = initials;
        
        // Mostrar abas de admin apenas para administradores
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            if (currentUser.role === 'admin') {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });

        // Mostrar recursos de master admin apenas para o e-mail master
        const masterAdminElements = document.querySelectorAll('.master-admin-only');
        masterAdminElements.forEach(el => {
            if (currentUser.role === 'admin' && currentUser.email === 'admin@grupofarmaconde.com.br') {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
        
        // Inicializar Dashboard
        dashboardDateInput.value = selectedDate;
        loadRoomsAndBookings();
        updateMyBookingsCount();
        
        lucide.createIcons();
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        token = null;
        currentUser = null;
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
    }
}

function handleLogout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    bootApp();
    showToast('Você saiu do sistema.', 'info');
}

// Alterar abas do painel lateral
sidebarMenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        const targetSectionId = item.getAttribute('data-target');
        
        // Atualiza botões ativos na barra lateral
        sidebarMenuItems.forEach(mi => mi.classList.remove('active'));
        item.classList.add('active');
        
        // Atualiza a visualização da seção
        contentSections.forEach(section => {
            if (section.id === targetSectionId) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
        
        // Atualizar títulos das páginas
        const mainTitle = document.getElementById('page-title');
        const mainSubtitle = document.getElementById('page-subtitle');
        
        if (targetSectionId === 'dashboard-section') {
            mainTitle.textContent = "Agendamentos de Salas";
            mainSubtitle.textContent = "Gerencie e reserve as salas de reunião da Farma Conde";
            loadRoomsAndBookings();
        } else if (targetSectionId === 'my-bookings-section') {
            mainTitle.textContent = "Minhas Reservas";
            mainSubtitle.textContent = "Acompanhe e faça check-in nas salas agendadas sob seu usuário";
            loadMyBookings();
        } else if (targetSectionId === 'admin-section') {
            mainTitle.textContent = "Painel Administrativo";
            mainSubtitle.textContent = "Relatórios de ocupação, no-shows e auditoria de backups";
            loadAdminPanel();
        }
    });
});

// ==========================================================================
// AUTENTICAÇÃO (LOGIN & CADASTRO)
// ==========================================================================

// Toggle formulários
goToRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
});

goToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

registerIsAdminCheckbox.addEventListener('change', () => {
    if (registerIsAdminCheckbox.checked) {
        adminCodeGroup.classList.remove('hidden');
        registerAdminCodeInput.setAttribute('required', 'required');
    } else {
        adminCodeGroup.classList.add('hidden');
        registerAdminCodeInput.removeAttribute('required');
        registerAdminCodeInput.value = '';
    }
});

// Envio de Cadastro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const isAdmin = registerIsAdminCheckbox.checked;
    const adminCode = registerAdminCodeInput.value;
    
    // Validação de email no front-end
    if (!email.toLowerCase().endsWith('@grupofarmaconde.com.br')) {
        showToast('Utilize um e-mail corporativo válido @grupofarmaconde.com.br', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('A senha precisa ter pelo menos 6 caracteres.', 'warning');
        return;
    }
    
    const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, adminCode: isAdmin ? adminCode : '' })
    });
    
    if (data && data.success) {
        showToast('Cadastro realizado com sucesso! Faça login.', 'success');
        registerForm.reset();
        adminCodeGroup.classList.add('hidden');
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }
});

// Envio de Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    
    if (data && data.success) {
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        loginForm.reset();
        showToast(`Bem-vindo, ${currentUser.name}!`, 'success');
        bootApp();
    }
});

logoutBtn.addEventListener('click', handleLogout);

// ==========================================================================
// CONTROLES DE DATA DO DASHBOARD
// ==========================================================================
function updateDashboardDate(newDateStr) {
    selectedDate = newDateStr;
    dashboardDateInput.value = selectedDate;
    loadRoomsAndBookings();
}

prevDayBtn.addEventListener('click', () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() - 1);
    updateDashboardDate(current.toISOString().split('T')[0]);
});

nextDayBtn.addEventListener('click', () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    updateDashboardDate(current.toISOString().split('T')[0]);
});

todayBtn.addEventListener('click', () => {
    updateDashboardDate(new Date().toISOString().split('T')[0]);
});

dashboardDateInput.addEventListener('change', () => {
    updateDashboardDate(dashboardDateInput.value);
});

// ==========================================================================
// AGENDAMENTOS E SALAS (RENDERIZAÇÃO)
// ==========================================================================
async function loadRoomsAndBookings() {
    roomsGrid.innerHTML = '<div class="empty-state"><i data-lucide="loader"></i><p>Carregando salas...</p></div>';
    lucide.createIcons();
    
    // Obter salas
    const roomsData = await apiFetch('/api/rooms');
    if (!roomsData) return;
    rooms = roomsData;
    
    // Obter agendamentos
    const bookingsData = await apiFetch('/api/bookings');
    if (!bookingsData) return;
    bookings = bookingsData;
    
    renderRoomsGrid();
    populateRoomOptions();
    
    // Verificar se há redirecionamento de QR Code escaneado pendente
    checkScannedRoomRedirect();
}

function renderRoomsGrid() {
    roomsGrid.innerHTML = '';
    
    if (rooms.length === 0) {
        roomsGrid.innerHTML = '<div class="empty-state"><p>Nenhuma sala cadastrada no sistema.</p></div>';
        return;
    }
    
    rooms.forEach(room => {
        // Filtrar agendamentos para esta sala na data selecionada
        const roomBookings = bookings.filter(b => {
            const bookingDate = b.start_time.split('T')[0];
            return b.room_id === room.id && bookingDate === selectedDate && b.status !== 'cancelled';
        });
        
        const card = document.createElement('div');
        card.className = 'room-card';
        
        // Tags de recursos da sala
        const featuresHtml = room.features 
            ? room.features.split(',').map(f => `<span class="feature-tag">${f.trim()}</span>`).join('')
            : '';
            
        // Lista de agendamentos na timeline
        let timelineHtml = '';
        if (roomBookings.length === 0) {
            timelineHtml = '<div class="empty-timeline">Consultar</div>';
        } else {
            roomBookings.forEach(b => {
                const startTimeStr = b.start_time.split('T')[1];
                const endTimeStr = b.end_time.split('T')[1];
                
                let statusLabel = 'Confirmado';
                if (b.status === 'checked_in') statusLabel = 'Check-in Realizado';
                if (b.status === 'no_show') statusLabel = 'No-show';
                
                timelineHtml += `
                    <div class="timeline-booking ${b.status}" title="Responsável: ${b.user_name} (${b.user_email})">
                        <span class="booking-time">${startTimeStr} - ${endTimeStr}</span>
                        <span class="booking-owner">${b.user_name}</span>
                        <span class="status-badge ${b.status}" style="font-size: 0.65rem; padding: 2px 6px;">${statusLabel}</span>
                    </div>
                `;
            });
        }
        
        card.innerHTML = `
            <div class="room-header">
                <h3>${room.name}</h3>
                <div class="room-capacity">
                    <i data-lucide="users"></i> Capacidade: ${room.capacity} pessoas
                </div>
            </div>
            <div class="room-body">
                <div class="room-features">
                    ${featuresHtml}
                </div>
                <div class="room-timeline-wrapper">
                    <div class="room-timeline-title" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Agenda de Hoje</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button class="btn-icon qr-code-btn" data-room-id="${room.id}" title="Gerar QR Code da Sala" style="width:24px; height:24px; padding:0; border:none; background:none; cursor:pointer;">
                                <i data-lucide="qr-code" style="width:14px; height:14px; color:var(--text-secondary);"></i>
                            </button>
                            <button class="btn-icon weekly-agenda-btn" data-room-id="${room.id}" title="Ver agenda semanal" style="width:24px; height:24px; padding:0; border:none; background:none; cursor:pointer;">
                                <i data-lucide="calendar-days" style="width:14px; height:14px; color:var(--primary-color);"></i>
                            </button>
                        </div>
                    </div>
                    <div class="room-timeline">
                        ${timelineHtml}
                    </div>
                </div>
            </div>
            <div class="room-footer">
                <button class="btn btn-primary btn-block reserve-btn" data-room-id="${room.id}">
                    <i data-lucide="plus"></i> Reservar esta Sala
                </button>
            </div>
        `;
        
        roomsGrid.appendChild(card);
    });
    
    // Bind eventos dos botões de reservar
    const reserveButtons = roomsGrid.querySelectorAll('.reserve-btn');
    reserveButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const roomId = btn.getAttribute('data-room-id');
            openBookingModal(roomId);
        });
    });

    // Bind eventos de visualização de agenda semanal
    const weeklyAgendaBtns = roomsGrid.querySelectorAll('.weekly-agenda-btn');
    weeklyAgendaBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const roomId = parseInt(btn.getAttribute('data-room-id'));
            openWeeklyCalendar(roomId);
        });
    });

    // Bind eventos de QR Code
    const qrCodeBtns = roomsGrid.querySelectorAll('.qr-code-btn');
    qrCodeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const roomId = parseInt(btn.getAttribute('data-room-id'));
            generateQRCodeForRoom(roomId);
        });
    });
    
    lucide.createIcons();
}

// ==========================================================================
// CRIAÇÃO DE AGENDAMENTOS (MODAL)
// ==========================================================================
function populateRoomOptions() {
    bookingRoomSelect.innerHTML = '';
    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = `${room.name} (Capacidade: ${room.capacity})`;
        bookingRoomSelect.appendChild(option);
    });
}

function openBookingModal(roomId = '') {
    // Resetar estado de edição
    bookingIdInput.value = '';
    bookingModalTitle.textContent = "Reservar Sala de Reunião";

    if (roomId) {
        bookingRoomSelect.value = roomId;
    }
    
    // Configura a data padrão para a selecionada no painel principal
    bookingDateInput.value = selectedDate;
    bookingDateInput.min = new Date().toISOString().split('T')[0]; // Não agendar no passado
    
    // Horário padrão
    document.getElementById('booking-start').value = "09:00";
    document.getElementById('booking-end').value = "10:00";

    // Novos campos
    bookingOrganizerInput.value = currentUser ? currentUser.name : '';
    bookingCompanyInput.value = 'Farma Conde';
    bookingSupplierNameInput.value = '';
    bookingSupplierCompanyInput.value = '';
    bookingMeetingTypeSelect.value = 'presencial';
    
    bookingModal.classList.remove('hidden');
}

function closeBookingModal() {
    bookingModal.classList.add('hidden');
}

newBookingBtn.addEventListener('click', () => openBookingModal());
const newBookingTriggers = document.querySelectorAll('.new-booking-trigger');
newBookingTriggers.forEach(t => t.addEventListener('click', () => openBookingModal()));

closeModalBtns.forEach(btn => {
    btn.addEventListener('click', closeBookingModal);
});

// Submit do agendamento (Criar ou Atualizar)
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const bookingId = bookingIdInput.value;
    const roomId = bookingRoomSelect.value;
    const date = bookingDateInput.value;
    const startTimeStr = document.getElementById('booking-start').value;
    const endTimeStr = document.getElementById('booking-end').value;
    const organizerName = bookingOrganizerInput.value.trim();
    const company = bookingCompanyInput.value.trim();
    const supplierName = bookingSupplierNameInput.value.trim();
    const supplierCompany = bookingSupplierCompanyInput.value.trim();
    const meetingType = bookingMeetingTypeSelect.value;
    
    const startTime = `${date}T${startTimeStr}`;
    const endTime = `${date}T${endTimeStr}`;
    
    let data;
    if (bookingId) {
        // Enviar requisição de edição
        data = await apiFetch('/api/bookings/update', {
            method: 'POST',
            body: JSON.stringify({ bookingId, roomId: parseInt(roomId), startTime, endTime, organizerName, company, supplierName, supplierCompany, meetingType })
        });
    } else {
        // Enviar requisição de criação
        data = await apiFetch('/api/bookings/create', {
            method: 'POST',
            body: JSON.stringify({ roomId: parseInt(roomId), startTime, endTime, organizerName, company, supplierName, supplierCompany, meetingType })
        });
    }
    
    if (data && data.success) {
        showToast(bookingId ? 'Reserva alterada com sucesso!' : 'Reserva cadastrada com sucesso!', 'success');
        closeBookingModal();
        loadRoomsAndBookings();
        
        // Recarregar aba de minhas reservas caso ativa
        const activeMenu = document.querySelector('.menu-item.active');
        if (activeMenu && activeMenu.getAttribute('data-target') === 'my-bookings-section') {
            loadMyBookings();
        }
        updateMyBookingsCount();
    }
});

// ==========================================================================
// MINHAS RESERVAS E AÇÕES (CHECK-IN / CANCELAR)
// ==========================================================================
async function updateMyBookingsCount() {
    const data = await apiFetch('/api/bookings');
    if (!data) return;
    
    const myCount = data.filter(b => b.user_id === currentUser.id && b.status === 'confirmed').length;
    if (myCount > 0) {
        myBookingsBadge.textContent = myCount;
        myBookingsBadge.classList.remove('hidden');
        if (mobileMyBookingsBadge) {
            mobileMyBookingsBadge.textContent = myCount;
            mobileMyBookingsBadge.classList.remove('hidden');
        }
    } else {
        myBookingsBadge.classList.add('hidden');
        if (mobileMyBookingsBadge) {
            mobileMyBookingsBadge.classList.add('hidden');
        }
    }
}

async function loadMyBookings() {
    myBookingsList.innerHTML = '<tr><td colspan="5" style="text-align: center;">Buscando suas reservas...</td></tr>';
    
    const bookingsData = await apiFetch('/api/bookings');
    if (!bookingsData) return;
    bookings = bookingsData;
    
    const myBookings = bookings.filter(b => b.user_id === currentUser.id || currentUser.role === 'admin');
    renderMyBookingsList(myBookings);
}

function renderMyBookingsList(myBookings) {
    myBookingsList.innerHTML = '';
    
    if (myBookings.length === 0) {
        myBookingsTable.classList.add('hidden');
        noBookingsMsg.classList.remove('hidden');
        return;
    }
    
    myBookingsTable.classList.remove('hidden');
    noBookingsMsg.classList.add('hidden');
    
    myBookings.forEach(b => {
        const row = document.createElement('tr');
        
        const dateStr = new Date(b.start_time.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR');
        const startHour = b.start_time.split('T')[1];
        const endHour = b.end_time.split('T')[1];
        
        let statusLabel = 'Confirmado';
        if (b.status === 'checked_in') statusLabel = 'Check-in Realizado';
        if (b.status === 'no_show') statusLabel = 'No-show';
        if (b.status === 'cancelled') statusLabel = 'Cancelado';
        
        // Ações disponíveis
        let actionsHtml = '-';
        if (b.status === 'confirmed') {
            const isOwner = b.user_id === currentUser.id;
            const checkInBtn = isOwner 
                ? `<button class="btn-checkin-pulse checkin-btn" data-booking-id="${b.id}">Check-in</button>` 
                : '';
            const editBtn = isOwner
                ? `<button class="btn-cancel-link edit-booking-btn" data-booking-id="${b.id}" style="color:var(--primary-color)">Editar</button>`
                : '';
            const cancelBtn = `<button class="btn-cancel-link cancel-btn" data-booking-id="${b.id}">Cancelar</button>`;
            actionsHtml = `<div class="action-group">${checkInBtn} ${editBtn} ${cancelBtn}</div>`;
        }
        
        const ownerIndicator = (currentUser.role === 'admin' && b.user_id !== currentUser.id)
            ? `<br><small style="color:var(--text-secondary)">Por: ${b.user_name}</small>`
            : '';
            
        row.innerHTML = `
            <td><strong>${b.room_name}</strong>${ownerIndicator}</td>
            <td>${dateStr}</td>
            <td>${startHour} às ${endHour}</td>
            <td><span class="status-badge ${b.status}">${statusLabel}</span></td>
            <td>${actionsHtml}</td>
        `;
        
        myBookingsList.appendChild(row);
    });
    
    // Bind eventos
    const checkinBtns = myBookingsList.querySelectorAll('.checkin-btn');
    checkinBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const bookingId = btn.getAttribute('data-booking-id');
            const data = await apiFetch('/api/bookings/check-in', {
                method: 'POST',
                body: JSON.stringify({ bookingId })
            });
            if (data && data.success) {
                showToast('Check-in realizado com sucesso! Sala ocupada.', 'success');
                loadMyBookings();
                updateMyBookingsCount();
            }
        });
    });

    const editBookingBtns = myBookingsList.querySelectorAll('.edit-booking-btn');
    editBookingBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const bookingId = btn.getAttribute('data-booking-id');
            openBookingModalForEdit(bookingId);
        });
    });
    
    const cancelBtns = myBookingsList.querySelectorAll('.cancel-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja cancelar esta reserva de sala?')) {
                const bookingId = btn.getAttribute('data-booking-id');
                const data = await apiFetch('/api/bookings/cancel', {
                    method: 'POST',
                    body: JSON.stringify({ bookingId })
                });
                if (data && data.success) {
                    showToast('Reserva cancelada com sucesso.', 'info');
                    loadMyBookings();
                    updateMyBookingsCount();
                }
            }
        });
    });
}

// ==========================================================================
// PAINEL ADMINISTRATIVO (RELATÓRIOS E BACKUP)
// ==========================================================================
async function loadAdminPanel() {
    // 1. Carregar Relatórios
    const reportData = await apiFetch('/api/admin/reports');
    if (reportData) {
        metricTotalBookings.textContent = reportData.total_bookings;
        metricCheckedIn.textContent = reportData.total_checked_in;
        metricNoShowRate.textContent = `${reportData.no_show_rate}%`;
        metricOccupancyRate.textContent = `${reportData.occupancy_rate}%`;
        
        renderRoomsChart(reportData.by_room);
    }
    
    // 4. Carregar Relatório Geral de Reservas
    loadAdminBookingsList();

    // Carregar recursos adicionais se for master admin
    if (currentUser && currentUser.role === 'admin' && currentUser.email === 'admin@grupofarmaconde.com.br') {
        // 2. Carregar Lista de Backups
        loadBackupsList();
        
        // 3. Carregar Lista de Salas para Gerenciamento
        loadAdminRoomsList();

        // 5. Carregar Lista de Usuários para Gerenciamento
        loadAdminUsersList();
    }
}

function renderRoomsChart(byRoomData) {
    roomsChartContainer.innerHTML = '';
    if (!byRoomData || byRoomData.length === 0) {
        roomsChartContainer.innerHTML = '<div class="empty-state"><p>Sem dados de agendamentos.</p></div>';
        return;
    }
    
    // Achar valor máximo para escala
    const maxVal = Math.max(...byRoomData.map(r => r.count), 1);
    
    byRoomData.forEach(item => {
        const pct = (item.count / maxVal) * 100;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        
        wrapper.innerHTML = `
            <div class="chart-bar" style="height: ${pct}%;">
                <span class="chart-bar-value">${item.count}</span>
            </div>
            <span class="chart-bar-label" title="${item.name}">${item.name}</span>
        `;
        
        roomsChartContainer.appendChild(wrapper);
    });
}

async function loadBackupsList() {
    backupsList.innerHTML = '<tr><td colspan="4" style="text-align: center;">Carregando histórico...</td></tr>';
    
    const backups = await apiFetch('/api/admin/backups/list');
    if (!backups) return;
    
    backupsList.innerHTML = '';
    
    if (backups.length === 0) {
        backupsList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">Nenhum backup encontrado no histórico.</td></tr>';
        return;
    }
    
    backups.forEach(b => {
        const row = document.createElement('tr');
        
        const dateStr = new Date(b.timestamp).toLocaleString('pt-BR');
        const typeLabel = b.type === 'automatic' 
            ? '<span class="status-badge checked_in" style="font-size:0.65rem">Diário Automático</span>' 
            : '<span class="status-badge pending" style="font-size:0.65rem">Manual</span>';
            
        const restoreBtnHtml = `<button class="btn btn-accent restore-backup-btn" data-filename="${b.filename}" style="font-size:0.75rem; padding:6px 12px; background-color:var(--accent-color); border-color:var(--accent-color); color:white;">Restaurar</button>`;
        
        row.innerHTML = `
            <td><code>${b.filename}</code></td>
            <td>${dateStr}</td>
            <td>${typeLabel}</td>
            <td>${restoreBtnHtml}</td>
        `;
        
        backupsList.appendChild(row);
    });
    
    // Bind eventos para restauração de backup
    backupsList.querySelectorAll('.restore-backup-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filename = btn.getAttribute('data-filename');
            
            if (confirm(`Atenção: Restaurar o backup "${filename}" substituirá todas as reservas, usuários e dados atuais do sistema!\n\nVocê tem certeza que deseja prosseguir?`)) {
                btn.disabled = true;
                btn.textContent = 'Restaurando...';
                
                const data = await apiFetch('/api/admin/backup/restore', {
                    method: 'POST',
                    body: JSON.stringify({ filename })
                });
                
                btn.disabled = false;
                btn.textContent = 'Restaurar';
                
                if (data && data.success) {
                    showToast('Backup restaurado com sucesso! Recarregando aplicação...', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                }
            }
        });
    });
}

// Disparar backup manual
triggerBackupBtn.addEventListener('click', async () => {
    triggerBackupBtn.disabled = true;
    triggerBackupBtn.innerHTML = '<i data-lucide="loader"></i> Gerando...';
    lucide.createIcons();
    
    const data = await apiFetch('/api/admin/backup/trigger', {
        method: 'POST'
    });
    
    triggerBackupBtn.disabled = false;
    triggerBackupBtn.innerHTML = '<i data-lucide="database"></i> Forçar Backup Agora';
    lucide.createIcons();
    
    if (data && data.success) {
        showToast('Backup do banco de dados SQLite gerado com sucesso!', 'success');
        loadBackupsList();
    }
});

// Promover usuário a admin
promoteAdminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = promoteEmailInput.value.trim();
    
    const data = await apiFetch('/api/admin/promote', {
        method: 'POST',
        body: JSON.stringify({ email })
    });
    
    if (data && data.success) {
        showToast(`Colaborador ${email} agora tem privilégios de Administrador.`, 'success');
        promoteAdminForm.reset();
    }
});

// --- GERENCIAMENTO DE SALAS (ADMIN) ---
async function loadAdminRoomsList() {
    adminRoomsList.innerHTML = '<tr><td colspan="4" style="text-align: center;">Carregando salas...</td></tr>';
    
    const roomsData = await apiFetch('/api/rooms');
    if (!roomsData) return;
    rooms = roomsData;
    
    adminRoomsList.innerHTML = '';
    
    rooms.forEach(room => {
        const row = document.createElement('tr');
        
        const featuresText = room.features || 'Nenhum recurso cadastrado';
        
        row.innerHTML = `
            <td><strong>${room.name}</strong></td>
            <td>${room.capacity} pessoas</td>
            <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${featuresText}</span></td>
            <td>
                <button class="btn btn-secondary admin-qr-btn" data-room-id="${room.id}" style="font-size:0.75rem; padding:6px 12px; margin-right:6px;">
                    <i data-lucide="qr-code" style="width:12px; height:12px; vertical-align:middle; margin-right:2px;"></i> QR Code
                </button>
                <button class="btn btn-secondary edit-room-btn" data-room-id="${room.id}" style="font-size:0.75rem; padding:6px 12px;">
                    Editar
                </button>
            </td>
        `;
        
        adminRoomsList.appendChild(row);
    });
    
    // Evento do botão Editar
    const editBtns = adminRoomsList.querySelectorAll('.edit-room-btn');
    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const roomId = parseInt(btn.getAttribute('data-room-id'));
            openRoomEditModal(roomId);
        });
    });

    // Evento do botão QR Code
    const adminQrBtns = adminRoomsList.querySelectorAll('.admin-qr-btn');
    adminQrBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const roomId = parseInt(btn.getAttribute('data-room-id'));
            generateQRCodeForRoom(roomId);
        });
    });
}

function openRoomEditModal(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    editRoomIdInput.value = room.id;
    editRoomNameInput.value = room.name;
    editRoomCapacityInput.value = room.capacity;
    editRoomFeaturesInput.value = room.features || '';
    
    roomModal.classList.remove('hidden');
    lucide.createIcons();
}

function closeRoomModal() {
    roomModal.classList.add('hidden');
    roomForm.reset();
}

// Bind eventos de fechar modal de salas
closeRoomModalBtns.forEach(btn => {
    btn.addEventListener('click', closeRoomModal);
});

// Submit do formulário de salas
roomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = parseInt(editRoomIdInput.value);
    const name = editRoomNameInput.value.trim();
    const capacity = parseInt(editRoomCapacityInput.value);
    const features = editRoomFeaturesInput.value.trim();
    
    const data = await apiFetch('/api/admin/rooms/update', {
        method: 'POST',
        body: JSON.stringify({ id, name, capacity, features })
    });
    
    if (data && data.success) {
        showToast('Dados da sala atualizados com sucesso!', 'success');
        closeRoomModal();
        
        // Recarregar os dados na tela
        loadRoomsAndBookings(); // Atualiza dashboard
        loadAdminPanel();       // Atualiza a tabela do admin e gráficos
    }
});

// --- GERENCIAMENTO DE RESERVAS (ADMIN & EDICAO) ---
function openBookingModalForEdit(bookingId) {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    bookingIdInput.value = booking.id;
    bookingModalTitle.textContent = "Alterar Reserva";
    
    bookingRoomSelect.value = booking.room_id;
    bookingDateInput.value = booking.start_time.split('T')[0];
    bookingDateInput.min = new Date().toISOString().split('T')[0]; // Não retroceder no passado
    
    document.getElementById('booking-start').value = booking.start_time.split('T')[1];
    document.getElementById('booking-end').value = booking.end_time.split('T')[1];

    // Novos campos
    bookingOrganizerInput.value = booking.organizer_name || booking.user_name || '';
    bookingCompanyInput.value = booking.company || 'Farma Conde';
    bookingSupplierNameInput.value = booking.supplier_name || '';
    bookingSupplierCompanyInput.value = booking.supplier_company || '';
    bookingMeetingTypeSelect.value = booking.meeting_type || 'presencial';
    
    bookingModal.classList.remove('hidden');
    lucide.createIcons();
}

async function loadAdminBookingsList() {
    adminBookingsList.innerHTML = '<tr><td colspan="6" style="text-align: center;">Carregando agendamentos...</td></tr>';
    
    const bookingsData = await apiFetch('/api/bookings');
    if (!bookingsData) return;
    bookings = bookingsData;
    
    adminBookingsList.innerHTML = '';
    
    if (bookings.length === 0) {
        adminBookingsList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Nenhum agendamento encontrado no sistema.</td></tr>';
        return;
    }
    
    bookings.forEach(b => {
        const row = document.createElement('tr');
        
        const dateStr = new Date(b.start_time.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR');
        const startHour = b.start_time.split('T')[1];
        const endHour = b.end_time.split('T')[1];
        
        let statusLabel = 'Confirmado';
        if (b.status === 'checked_in') statusLabel = 'Check-in Realizado';
        if (b.status === 'no_show') statusLabel = 'No-show';
        if (b.status === 'cancelled') statusLabel = 'Cancelado';
        
        // Administrador pode cancelar qualquer reserva pendente ou ativa
        let actionHtml = '-';
        if (b.status === 'confirmed' || b.status === 'checked_in') {
            actionHtml = `<button class="btn-cancel-link admin-cancel-btn" data-booking-id="${b.id}">Cancelar</button>`;
        }
        
        row.innerHTML = `
            <td><strong>${b.room_name}</strong></td>
            <td>${b.user_name}<br><small style="color:var(--text-secondary)">${b.user_email}</small></td>
            <td>${dateStr}</td>
            <td>${startHour} às ${endHour}</td>
            <td><span class="status-badge ${b.status}">${statusLabel}</span></td>
            <td>${actionHtml}</td>
        `;
        
        adminBookingsList.appendChild(row);
    });
    
    // Vincular eventos de cancelamento pelo admin
    const cancelBtns = adminBookingsList.querySelectorAll('.admin-cancel-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja cancelar esta reserva administrativamente?')) {
                const bookingId = btn.getAttribute('data-booking-id');
                const data = await apiFetch('/api/bookings/cancel', {
                    method: 'POST',
                    body: JSON.stringify({ bookingId })
                });
                if (data && data.success) {
                    showToast('Reserva cancelada administrativamente.', 'info');
                    loadAdminPanel(); // Recarrega o painel admin (incluindo relatórios e tabelas)
                    loadRoomsAndBookings(); // Atualiza dashboard
                }
            }
        });
    });
}

function printRoomSchedule(roomId, dateStr) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Obter segunda-feira da semana contendo dateStr
    const monday = getStartOfWeek(new Date(dateStr + 'T00:00:00'));
    
    // Gerar as datas dos dias úteis (Segunda a Sexta)
    const weekDates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(d);
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Por favor, ative os pop-ups no seu navegador para imprimir a agenda.', 'warning');
        return;
    }
    
    const rangeStart = weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const rangeEnd = weekDates[4].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const weekdayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    
    // Horários comerciais (08:00 às 18:00)
    const hourSlots = [
        { start: "08:00", end: "09:00" },
        { start: "09:00", end: "10:00" },
        { start: "10:00", end: "11:00" },
        { start: "11:00", end: "12:00" },
        { start: "12:00", end: "13:00" },
        { start: "13:00", end: "14:00" },
        { start: "14:00", end: "15:00" },
        { start: "15:00", end: "16:00" },
        { start: "16:00", end: "17:00" },
        { start: "17:00", end: "18:00" }
    ];
    
    // Filtrar todas as reservas ativas da sala
    const roomBookings = bookings.filter(b => b.room_id === roomId && b.status !== 'cancelled');
    
    let tableRowsHtml = '';
    
    hourSlots.forEach(slot => {
        tableRowsHtml += '<tr>';
        // Coluna de Horário
        tableRowsHtml += `<td class="time-col"><strong>${slot.start} às ${slot.end}</strong></td>`;
        
        // Colunas dos Dias (Segunda a Sexta)
        for (let i = 0; i < 5; i++) {
            const dayDate = weekDates[i];
            const dayISO = dayDate.toISOString().split('T')[0];
            
            // Horário completo de início e fim da célula
            const cellStartISO = `${dayISO}T${slot.start}`;
            const cellEndISO = `${dayISO}T${slot.end}`;
            
            // Procurar reservas que intersectam com este slot de tempo
            const booking = roomBookings.find(b => b.start_time < cellEndISO && b.end_time > cellStartISO);
            
            if (booking) {
                let statusLabel = 'Confirmado';
                if (booking.status === 'checked_in') statusLabel = 'Check-in Realizado';
                if (booking.status === 'no_show') statusLabel = 'No-show';
                
                const organizer = booking.organizer_name || booking.user_name;
                const company = booking.company || 'Farma Conde';
                const supplier = booking.supplier_name || '-';
                const supplierCo = booking.supplier_company || '-';
                const typeLabel = booking.meeting_type === 'videoconferencia' ? 'Vídeo' : 'Presencial';
                
                tableRowsHtml += `
                    <td class="booked-cell ${booking.status}">
                        <div class="cell-content">
                            <span class="owner-name">${organizer} vs ${supplier}</span>
                            <span class="company-name">${supplierCo} (${company})</span>
                            <div class="meta-row">
                                <span class="meeting-type-badge ${booking.meeting_type || 'presencial'}">${typeLabel}</span>
                                <span class="status-tag ${booking.status}">${statusLabel}</span>
                            </div>
                        </div>
                    </td>
                `;
            } else {
                tableRowsHtml += `
                    <td class="empty-cell">Consultar</td>
                `;
            }
        }
        tableRowsHtml += '</tr>';
    });
    
    let tableHeaderHtml = `
        <tr>
            <th style="width: 10%;">Horário</th>
    `;
    for (let i = 0; i < 5; i++) {
        const dateLabel = weekDates[i].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        tableHeaderHtml += `
            <th style="width: 18%;">${weekdayNames[i]}<br><span style="font-size:0.7rem; font-weight:normal; opacity:0.85;">${dateLabel}</span></th>
        `;
    }
    tableHeaderHtml += '</tr>';

    const printContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Agenda Semanal - ${room.name}</title>
        <style>
            @media print {
                @page { 
                    size: landscape; 
                    margin: 0.4cm; 
                }
                body {
                    margin: 0;
                    padding: 0;
                    background-color: #ffffff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
            body {
                font-family: 'Segoe UI', Arial, sans-serif;
                color: #1E293B;
                margin: 10px;
                padding: 0;
                background-color: #ffffff;
            }
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 3px solid #0038A8;
                padding-bottom: 6px;
                margin-bottom: 8px;
            }
            .logo-circle {
                width: 42px;
                height: 42px;
            }
            .title-area h1 {
                margin: 0;
                color: #0038A8;
                font-size: 1.4rem;
                font-weight: 800;
            }
            .title-area p {
                margin: 2px 0 0 0;
                color: #FF7000;
                font-weight: 700;
                text-transform: uppercase;
                font-size: 0.7rem;
                letter-spacing: 0.5px;
            }
            .room-info {
                font-size: 0.8rem;
                color: #475569;
                margin-bottom: 8px;
                background-color: #F8FAFC;
                padding: 4px 10px;
                border-radius: 4px;
                border: 1px solid #E2E8F0;
                display: flex;
                justify-content: space-between;
            }
            .room-info span strong {
                color: #0038A8;
            }
            
            /* Tabela Grid */
            .grid-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }
            .grid-table th, .grid-table td {
                border: 1px solid #CBD5E1;
                text-align: center;
                vertical-align: middle;
                word-wrap: break-word;
            }
            .grid-table th {
                background-color: #0038A8;
                color: #ffffff;
                padding: 6px 2px;
                font-weight: 700;
                font-size: 0.75rem;
                text-transform: uppercase;
            }
            .grid-table td {
                height: 42px;
                padding: 2px;
                font-size: 0.7rem;
            }
            
            .time-col {
                background-color: #F1F5F9;
                color: #0038A8;
                font-weight: 700;
                font-size: 0.7rem;
            }
            
            .empty-cell {
                color: #94A3B8;
                font-style: italic;
                font-weight: 600;
                background-color: #FAFAFA;
            }
            
            .booked-cell {
                padding: 2px !important;
            }
            .booked-cell.pending {
                background-color: #FEF3C7 !important;
                color: #D97706;
            }
            .booked-cell.checked_in {
                background-color: #D1FAE5 !important;
                color: #059669;
            }
            .booked-cell.no_show {
                background-color: #FEE2E2 !important;
                color: #DC2626;
            }
            
            .cell-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                gap: 1px;
            }
            
            .owner-name {
                font-weight: 700;
                font-size: 0.7rem;
                line-height: 1.1;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .company-name {
                font-size: 0.62rem;
                font-weight: 600;
                opacity: 0.9;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .meta-row {
                display: flex;
                gap: 4px;
                justify-content: center;
                align-items: center;
                margin-top: 1px;
            }
            
            .meeting-type-badge {
                font-size: 0.58rem;
                font-weight: 700;
                text-transform: uppercase;
                opacity: 0.8;
            }
            
            .status-tag {
                font-size: 0.55rem;
                font-weight: 700;
                text-transform: uppercase;
                padding: 0px 2px;
                border-radius: 2px;
                background-color: rgba(255, 255, 255, 0.8);
                border: 1px solid currentColor;
            }
            
            .footer {
                margin-top: 8px;
                border-top: 1px solid #E2E8F0;
                padding-top: 6px;
                text-align: center;
                font-size: 0.65rem;
                color: #64748B;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title-area">
                <h1>${room.name}</h1>
                <p>FARMA CONDE — PROGRAMAÇÃO SEMANAL DE USO</p>
            </div>
            <!-- Logo SVG -->
            <svg viewBox="0 0 100 100" class="logo-circle">
                <circle cx="50" cy="50" r="48" fill="#FF7000"/>
                <rect x="15" y="32" width="70" height="28" rx="4" fill="#0038A8"/>
                <text x="50" y="50" fill="#FFFFFF" font-family="Arial" font-weight="bold" font-size="9" text-anchor="middle">FARMA CONDE</text>
                <line x1="20" y1="53" x2="80" y2="53" stroke="#FFFFFF" stroke-width="1"/>
                <path d="M47 46 h6 v2 h-6 z M49 44 h2 v6 h-2 z" fill="#FF7000"/>
            </svg>
        </div>
        
        <div class="room-info">
            <span>Período: <strong>${rangeStart} a ${rangeEnd}</strong></span>
            <span>Capacidade: <strong>${room.capacity} Pessoas</strong></span>
            <span>Recursos: <strong>${room.features || 'Nenhum'}</strong></span>
        </div>
        
        <table class="grid-table">
            <thead>
                ${tableHeaderHtml}
            </thead>
            <tbody>
                ${tableRowsHtml}
            </tbody>
        </table>
        
        <div class="footer">
            Atenção: Realize o check-in na sala no início da sua reunião. Caso o check-in não seja feito em até 15 minutos do horário agendado, a reserva será cancelada automaticamente por no-show e a sala liberada.
        </div>
        
        <script>
            window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
            };
        <\/script>
    </body>
    </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// --- CALENDÁRIO SEMANAL (WEEKLY CALENDAR) ---
function getStartOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira
    return new Date(date.setDate(diff));
}

function openWeeklyCalendar(roomId) {
    weeklyRoomId = roomId;
    // Define a data inicial para a segunda-feira da semana da data selecionada no dashboard
    weeklyStartDate = getStartOfWeek(new Date(selectedDate + 'T00:00:00'));
    
    const room = rooms.find(r => r.id === roomId);
    weeklyModalTitle.textContent = `Agenda Semanal — ${room.name}`;
    
    renderWeeklyCalendar();
    weeklyModal.classList.remove('hidden');
    lucide.createIcons();
}

function renderWeeklyCalendar() {
    weeklyCalendarGrid.innerHTML = '';
    
    // Gerar as datas dos dias úteis (Segunda a Sexta)
    const weekDates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(weeklyStartDate);
        d.setDate(weeklyStartDate.getDate() + i);
        weekDates.push(d);
    }
    
    // Atualizar range de datas na toolbar do modal
    const startStr = weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const endStr = weekDates[4].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    weeklyRangeLabel.textContent = `Semana de ${startStr} a ${endStr}`;
    
    // Atualizar cabeçalho da tabela com os números dos dias (ex: Segunda 15/06)
    const weekdayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    for (let i = 0; i < 5; i++) {
        const cell = document.getElementById(`weekly-day-${i}`);
        const dateLabel = weekDates[i].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        cell.innerHTML = `${weekdayNames[i]}<br><span style="font-size:0.75rem; font-weight:normal; opacity:0.8;">${dateLabel}</span>`;
    }
    
    // Horários comerciais (08:00 às 18:00)
    const hourSlots = [
        { start: "08:00", end: "09:00" },
        { start: "09:00", end: "10:00" },
        { start: "10:00", end: "11:00" },
        { start: "11:00", end: "12:00" },
        { start: "12:00", end: "13:00" },
        { start: "13:00", end: "14:00" },
        { start: "14:00", end: "15:00" },
        { start: "15:00", end: "16:00" },
        { start: "16:00", end: "17:00" },
        { start: "17:00", end: "18:00" }
    ];
    
    // Filtrar todas as reservas ativas da sala
    const roomBookings = bookings.filter(b => b.room_id === weeklyRoomId && b.status !== 'cancelled');
    
    hourSlots.forEach(slot => {
        const row = document.createElement('tr');
        
        // Coluna de Horário
        const timeCell = document.createElement('td');
        timeCell.innerHTML = `<strong style="color:var(--primary-color); font-size:0.85rem;">${slot.start} às ${slot.end}</strong>`;
        timeCell.style.textAlign = 'center';
        row.appendChild(timeCell);
        
        // Colunas dos Dias (Segunda a Sexta)
        for (let i = 0; i < 5; i++) {
            const dayDate = weekDates[i];
            const dateStr = dayDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
            
            // Horário completo de início e fim da célula
            const cellStartISO = `${dateStr}T${slot.start}`;
            const cellEndISO = `${dateStr}T${slot.end}`;
            
            // Procurar reservas que intersectam com este slot de tempo
            const booking = roomBookings.find(b => b.start_time < cellEndISO && b.end_time > cellStartISO);
            
            const dayCell = document.createElement('td');
            
            if (booking) {
                let statusLabel = 'Confirmado';
                if (booking.status === 'checked_in') statusLabel = 'Check-in Realizado';
                if (booking.status === 'no_show') statusLabel = 'No-show';
                
                const organizer = booking.organizer_name || booking.user_name;
                const company = booking.company || 'Farma Conde';
                const typeLabel = booking.meeting_type === 'videoconferencia' ? 'Vídeo' : 'Presencial';
                const supplier = booking.supplier_name || '-';
                const supplierCo = booking.supplier_company || '-';
                
                dayCell.innerHTML = `
                    <div class="weekly-cell booked ${booking.status}" title="Responsável: ${organizer} (${company})\nFornecedor: ${supplier} (${supplierCo})\nTipo: ${typeLabel}\nStatus: ${statusLabel}">
                        <span class="cell-owner" style="font-weight: 700;">${organizer} vs ${supplier}</span>
                        <span style="font-size:0.58rem; opacity:0.95; font-weight: 600;">${supplierCo} (${typeLabel})</span>
                    </div>
                `;
            } else {
                // Verificar se é no passado
                const slotStartDt = new Date(`${dateStr}T${slot.start}:00`);
                const isPast = slotStartDt < new Date();
                
                if (isPast) {
                    dayCell.innerHTML = `
                        <div class="weekly-cell free" style="opacity:0.5; background:#E2E8F0; cursor:not-allowed; border: 1px solid var(--border-color)">
                            <span style="color:var(--text-muted)">Bloqueado</span>
                        </div>
                    `;
                } else {
                    dayCell.innerHTML = `
                        <div class="weekly-cell free">
                            <span style="font-weight: 600;">Consultar</span>
                            <button class="cell-btn-add" data-date="${dateStr}" data-hour="${slot.start}" data-end="${slot.end}">+</button>
                        </div>
                    `;
                }
            }
            row.appendChild(dayCell);
        }
        weeklyCalendarGrid.appendChild(row);
    });
    
    // Vincular eventos dos botões de adicionar reserva no grid
    const addBtns = weeklyCalendarGrid.querySelectorAll('.cell-btn-add');
    addBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const date = btn.getAttribute('data-date');
            const startHour = btn.getAttribute('data-hour');
            const endHour = btn.getAttribute('data-end');
            openBookingModalForSlot(weeklyRoomId, date, startHour, endHour);
        });
    });
}

function openBookingModalForSlot(roomId, dateStr, startHourStr, endHourStr) {
    // Fechar modal semanal
    weeklyModal.classList.add('hidden');
    
    // Abrir modal de criação padrão
    openBookingModal(roomId);
    
    // Sobrescrever com os dados do slot clicado
    bookingDateInput.value = dateStr;
    document.getElementById('booking-start').value = startHourStr;
    document.getElementById('booking-end').value = endHourStr;
}

// Bind de eventos de navegação semanal
prevWeekBtn.addEventListener('click', () => {
    weeklyStartDate.setDate(weeklyStartDate.getDate() - 7);
    renderWeeklyCalendar();
});

nextWeekBtn.addEventListener('click', () => {
    weeklyStartDate.setDate(weeklyStartDate.getDate() + 7);
    renderWeeklyCalendar();
});

currentWeekBtn.addEventListener('click', () => {
    weeklyStartDate = getStartOfWeek(new Date());
    renderWeeklyCalendar();
});

closeWeeklyModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        weeklyModal.classList.add('hidden');
    });
});

printWeeklyBtn.addEventListener('click', () => {
    if (weeklyRoomId && weeklyStartDate) {
        printRoomSchedule(weeklyRoomId, weeklyStartDate.toISOString().split('T')[0]);
    }
});

// --- GERENCIAMENTO DE USUÁRIOS (ADMIN) ---
async function loadAdminUsersList() {
    if (!adminUsersList) return;
    adminUsersList.innerHTML = '<tr><td colspan="5" style="text-align: center;">Carregando usuários...</td></tr>';
    
    const usersData = await apiFetch('/api/admin/users/list');
    if (!usersData) return;
    
    adminUsersList.innerHTML = '';
    
    usersData.forEach(u => {
        const row = document.createElement('tr');
        
        const isSelf = u.id === currentUser.id;
        const deleteBtnHtml = isSelf
            ? `<button class="btn btn-secondary" disabled style="font-size:0.75rem; padding:6px 12px; opacity:0.5; cursor:not-allowed;">Excluir</button>`
            : `<button class="btn btn-accent delete-user-btn" data-user-id="${u.id}" data-user-name="${u.name}" style="font-size:0.75rem; padding:6px 12px; background-color:var(--danger); border-color:var(--danger);">Excluir</button>`;
            
        const editPwBtnHtml = `<button class="btn btn-secondary edit-pw-btn" data-user-id="${u.id}" data-user-name="${u.name}" style="font-size:0.75rem; padding:6px 12px; margin-right:6px;">Alterar Senha</button>`;
        
        const roleLabel = u.role === 'admin' ? '<span class="status-badge checked_in" style="font-size:0.65rem;">Admin</span>' : '<span class="status-badge cancelled" style="font-size:0.65rem;">Colaborador</span>';
        
        row.innerHTML = `
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td>
                <div class="password-wrapper" style="display:flex; align-items:center; gap:8px;">
                    <span class="password-text" data-password="${u.password}" style="font-family: monospace; font-size:0.9rem;">••••••••</span>
                    <button type="button" class="btn-icon toggle-password-btn" style="width:24px; height:24px; padding:0; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Mostrar/Ocultar Senha">
                        <i data-lucide="eye" style="width:16px; height:16px; color:var(--primary-color);"></i>
                    </button>
                </div>
            </td>
            <td>${roleLabel}</td>
            <td>
                <div style="display:flex; align-items:center;">
                    ${editPwBtnHtml}
                    ${deleteBtnHtml}
                </div>
            </td>
        `;
        
        adminUsersList.appendChild(row);
    });
    
    // Bind eventos de toggle de senha
    adminUsersList.querySelectorAll('.toggle-password-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const span = btn.previousElementSibling;
            const isMasked = span.textContent === '••••••••';
            if (isMasked) {
                span.textContent = span.getAttribute('data-password');
                btn.innerHTML = '<i data-lucide="eye-off" style="width:16px; height:16px; color:var(--text-secondary);"></i>';
            } else {
                span.textContent = '••••••••';
                btn.innerHTML = '<i data-lucide="eye" style="width:16px; height:16px; color:var(--primary-color);"></i>';
            }
            lucide.createIcons();
        });
    });
    
    // Bind eventos para os botões da lista
    adminUsersList.querySelectorAll('.edit-pw-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            const userName = btn.getAttribute('data-user-name');
            openUserPasswordModal(userId, userName);
        });
    });
    
    adminUsersList.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.getAttribute('data-user-id');
            const userName = btn.getAttribute('data-user-name');
            
            if (confirm(`Tem certeza que deseja excluir permanentemente o usuário "${userName}"?\nIsso apagará todas as suas reservas e sessões ativas!`)) {
                const data = await apiFetch('/api/admin/users/delete', {
                    method: 'POST',
                    body: JSON.stringify({ userId })
                });
                
                if (data && data.success) {
                    showToast('Usuário excluído com sucesso!', 'success');
                    loadAdminUsersList();
                    loadRoomsAndBookings(); // Atualiza dashboard caso tivessem reservas apagadas
                }
            }
        });
    });
}

function openUserPasswordModal(userId, userName) {
    editUserIdInput.value = userId;
    editUserNameInput.value = userName;
    editUserPasswordInput.value = '';
    userPasswordModal.classList.remove('hidden');
    lucide.createIcons();
}

function closeUserPasswordModal() {
    userPasswordModal.classList.add('hidden');
    userPasswordForm.reset();
}

// Bind eventos de fechar modal de usuário
closeUserModalBtns.forEach(btn => {
    btn.addEventListener('click', closeUserPasswordModal);
});

// Envio do formulário de nova senha
userPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = editUserIdInput.value;
    const password = editUserPasswordInput.value;
    
    const data = await apiFetch('/api/admin/users/update-password', {
        method: 'POST',
        body: JSON.stringify({ userId, password })
    });
    
    if (data && data.success) {
        showToast('Senha do usuário atualizada com sucesso!', 'success');
        closeUserPasswordModal();
        loadAdminUsersList();
    }
});

// ==========================================================================
// FUNÇÕES E EVENTOS DO QR CODE
// ==========================================================================
let qrcodeInstance = null;
let selectedQrRoomId = null;

async function generateQRCodeForRoom(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    selectedQrRoomId = roomId;
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '';
    
    // URL format: http://<domain>:<port>/?room=<id>
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${room.id}`;
    
    qrcodeInstance = new QRCode(container, {
        text: roomUrl,
        width: 180,
        height: 180,
        colorDark : "#0038A8",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    document.getElementById('qrcode-room-name').textContent = room.name;
    document.getElementById('qrcode-room-info').textContent = `Capacidade: ${room.capacity} Pessoas | ${room.features || 'Reuniões'}`;
    
    // Alerta se acessando via localhost
    const warningEl = document.getElementById('qrcode-localhost-warning');
    const warningIpEl = document.getElementById('localhost-warning-ip');
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        warningEl.classList.remove('hidden');
        // Buscar IP real da rede local no backend
        const ipData = await apiFetch('/api/local-ip');
        if (ipData && ipData.localIp) {
            warningIpEl.textContent = `http://${ipData.localIp}:${ipData.port}`;
        }
    } else {
        warningEl.classList.add('hidden');
    }
    
    qrcodeModal.classList.remove('hidden');
    lucide.createIcons();
}

function printRoomQRCode(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Por favor, ative os pop-ups no seu navegador para imprimir o QR Code.', 'warning');
        return;
    }
    
    const qrCanvas = document.querySelector('#qrcode-container canvas');
    if (!qrCanvas) {
        showToast('Erro ao obter imagem do QR Code para impressão.', 'error');
        return;
    }
    const qrImageSrc = qrCanvas.toDataURL("image/png");
    
    const printContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Imprimir QR Code - ${room.name}</title>
        <style>
            @page {
                size: A4 portrait;
                margin: 0;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: white;
                color: #1E293B;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .qrcode-card {
                border: 3px solid #0038A8;
                border-radius: 20px;
                padding: 40px;
                background: white;
                text-align: center;
                max-width: 420px;
                width: 100%;
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                box-sizing: border-box;
            }
            .logo-circle {
                width: 60px;
                height: 60px;
                margin: 0 auto 16px auto;
            }
            h1 {
                font-size: 2.2rem;
                font-weight: 800;
                color: #0038A8;
                margin: 12px 0 6px 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-family: 'Outfit', sans-serif;
            }
            .room-info {
                font-size: 1rem;
                color: #475569;
                font-weight: 600;
                margin-bottom: 24px;
            }
            .qr-image {
                width: 220px;
                height: 220px;
                margin: 0 auto;
                padding: 10px;
                border: 1px solid #E2E8F0;
                border-radius: 12px;
                background: white;
            }
            .instructions {
                font-size: 0.9rem;
                color: #64748B;
                margin-top: 24px;
                line-height: 1.5;
                font-weight: 500;
            }
            .branding {
                margin-top: 20px;
                font-size: 0.75rem;
                color: #94A3B8;
                letter-spacing: 2px;
                text-transform: uppercase;
                font-weight: bold;
            }
            @media print {
                body {
                    height: 100%;
                }
                .qrcode-card {
                    border: 4px solid #0038A8 !important;
                    box-shadow: none !important;
                    margin: auto;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }
            }
        </style>
    </head>
    <body>
        <div class="qrcode-card">
            <svg viewBox="0 0 100 100" class="logo-circle">
                <circle cx="50" cy="50" r="48" fill="#FF7000"/>
                <rect x="15" y="32" width="70" height="28" rx="4" fill="#0038A8"/>
                <text x="50" y="50" fill="#FFFFFF" font-family="Arial" font-weight="bold" font-size="9" text-anchor="middle">FARMA CONDE</text>
                <line x1="20" y1="53" x2="80" y2="53" stroke="#FFFFFF" stroke-width="1"/>
                <path d="M47 46 h6 v2 h-6 z M49 44 h2 v6 h-2 z" fill="#FF7000"/>
            </svg>
            <h1>${room.name}</h1>
            <div class="room-info">Capacidade: ${room.capacity} Pessoas | ${room.features || 'Reuniões'}</div>
            <img class="qr-image" src="${qrImageSrc}" alt="QR Code da Sala">
            <div class="instructions">
                Aponte a câmera do seu celular para<br><strong>Ver a Agenda e Reservar esta Sala</strong>
            </div>
            <div class="branding">Farma Conde Grupo</div>
        </div>
        
        <script>
            window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
            };
        <\/script>
    </body>
    </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
}

function checkScannedRoomRedirect() {
    const scanRoomId = sessionStorage.getItem('scanRoomId');
    if (scanRoomId) {
        sessionStorage.removeItem('scanRoomId');
        const roomIdNum = parseInt(scanRoomId);
        const room = rooms.find(r => r.id === roomIdNum);
        if (room) {
            setTimeout(() => {
                openWeeklyCalendar(roomIdNum);
                showToast(`Acesso rápido: Agenda de ${room.name}`, 'info');
            }, 300);
        }
    }
}

// ==========================================================================
// VINCULAÇÃO DE COMPONENTES MOBILE
// ==========================================================================
if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', handleLogout);
}

if (mobileFabBtn) {
    mobileFabBtn.addEventListener('click', () => {
        openBookingModal();
    });
}

// Sincronizar clique da barra de navegação inferior mobile
mobileNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSectionId = item.getAttribute('data-target');
        
        // Encontrar item de menu correspondente na sidebar desktop e simular clique
        const matchingSidebarItem = Array.from(sidebarMenuItems).find(mi => mi.getAttribute('data-target') === targetSectionId);
        if (matchingSidebarItem) {
            matchingSidebarItem.click();
        }
        
        mobileNavItems.forEach(mi => mi.classList.remove('active'));
        item.classList.add('active');
    });
});

// Sincronizar seleção mobile com cliques desktop
sidebarMenuItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetSectionId = item.getAttribute('data-target');
        mobileNavItems.forEach(mi => {
            if (mi.getAttribute('data-target') === targetSectionId) {
                mi.classList.add('active');
            } else {
                mi.classList.remove('active');
            }
        });
    });
});

// Eventos de Fechamento do Modal de QR Code
closeQrcodeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        qrcodeModal.classList.add('hidden');
    });
});

if (printQrcodeBtn) {
    printQrcodeBtn.addEventListener('click', () => {
        if (selectedQrRoomId) {
            printRoomQRCode(selectedQrRoomId);
        }
    });
}

// ==========================================================================
// INICIALIZAÇÃO DO APP
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    bootApp();
});
