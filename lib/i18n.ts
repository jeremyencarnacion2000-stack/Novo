'use client'

import { useSettings } from './settings-context';

type Language = 'en' | 'es' | 'fr' | 'de';

const translations: Record<Language, Record<string, string>> = {
    en: {
        // Settings - Appearance
        'settings.appearance.title': 'Appearance',
        'settings.appearance.desc': 'Customize the look and feel of Novo',
        'settings.theme.label': 'Theme',
        'settings.theme.desc': 'Choose your preferred color scheme',
        'settings.compact.label': 'Compact Mode',
        'settings.compact.desc': 'Use less spacing in the interface',
        'settings.animations.label': 'Animations',
        'settings.animations.desc': 'Enable smooth transitions and effects',

        // Settings - General
        'settings.general.title': 'General',
        'settings.general.desc': 'Regional and format preferences',
        'settings.language.label': 'Language',
        'settings.language.desc': 'Interface language',
        'settings.start_week.label': 'Start of Week',
        'settings.start_week.desc': 'First day of your week',
        'settings.date_format.label': 'Date Format',
        'settings.date_format.desc': 'How dates are displayed',
        'settings.time_format.label': 'Time Format',
        'settings.time_format.desc': '12-hour or 24-hour clock',

        // Settings - Notifications
        'settings.notifications.title': 'Notifications',
        'settings.notifications.desc': 'Manage how you receive updates and reminders',
        'settings.daily_reminder.label': 'Daily Reminder',
        'settings.daily_reminder.desc': 'Get a daily reminder to check your tasks',
        'settings.reminder_time.label': 'Reminder Time',
        'settings.reminder_time.desc': 'When to send daily reminders',
        'settings.routine_notif.label': 'Routine Notifications',
        'settings.routine_notif.desc': 'Alerts for your scheduled routines',
        'settings.project_deadlines.label': 'Project Deadlines',
        'settings.project_deadlines.desc': 'Reminders for upcoming project deadlines',

        // Settings - Profile
        'settings.profile.title': 'Profile',
        'settings.profile.desc': 'Manage your personal information',
        'settings.display_name': 'Display Name',
        'settings.email': 'Email',
        'settings.password': 'Password',
        'settings.change_password': 'Change Password',

        // Settings - Data
        'settings.data.title': 'Data & Privacy',
        'settings.data.desc': 'Control your data and backup settings',
        'settings.auto_backup.label': 'Automatic Backup',
        'settings.auto_backup.desc': 'Automatically backup your data',
        'settings.backup_freq.label': 'Backup Frequency',
        'settings.backup_freq.desc': 'How often to backup your data',
        'settings.export.label': 'Export Data',
        'settings.export.desc': 'Download all your data as a JSON backup file.',
        'settings.import.label': 'Import Data',
        'settings.import.desc': 'Restore your data from a JSON backup file. Existing data will be overwritten.',
        'settings.danger.label': 'Danger Zone',
        'settings.delete_all': 'Delete All Data',

        // Dashboard Greetings
        'greeting.morning': 'Good morning',
        'greeting.afternoon': 'Good afternoon',
        'greeting.evening': 'Good evening',

        // Sidebar - Section Titles
        'sidebar.overview': 'Overview',
        'sidebar.productivity': 'Productivity',
        'sidebar.life_growth': 'Life & Growth',

        // Sidebar - Items
        'sidebar.dashboard': 'Dashboard',
        'sidebar.today': 'Today',
        'sidebar.analytics': 'Analytics',
        'sidebar.calendar': 'Calendar',
        'sidebar.ai': 'AI Assistant',
        'sidebar.focus': 'Focus',
        'sidebar.routines': 'Routines',
        'sidebar.checklist': 'Checklist',
        'sidebar.projects': 'Projects',
        'sidebar.trackers': 'Trackers',
        'sidebar.school': 'School',
        'sidebar.business': 'Business',
        'sidebar.library': 'Library',
        'sidebar.social': 'Social',
        'sidebar.spiritual': 'Spiritual',
        'sidebar.appearance': 'Appearance',
        'sidebar.music': 'Music',
        'sidebar.notes': 'Notes',
        'sidebar.pinned': 'Pinned',
        'sidebar.settings': 'Settings',
        'sidebar.logout': 'Log out',
        'sidebar.life_context': 'Life Context',
        'sidebar.cognitive_engine': 'Cognitive Engine',
    },
    es: {
        // Settings - Appearance
        'settings.appearance.title': 'Apariencia',
        'settings.appearance.desc': 'Personaliza el aspecto de Novo',
        'settings.theme.label': 'Tema',
        'settings.theme.desc': 'Elige tu esquema de colores preferido',
        'settings.compact.label': 'Modo Compacto',
        'settings.compact.desc': 'Usar menos espacio en la interfaz',
        'settings.animations.label': 'Animaciones',
        'settings.animations.desc': 'Habilitar transiciones y efectos suaves',

        // Settings - General
        'settings.general.title': 'General',
        'settings.general.desc': 'Preferencias regionales y de formato',
        'settings.language.label': 'Idioma',
        'settings.language.desc': 'Idioma de la interfaz',
        'settings.start_week.label': 'Inicio de Semana',
        'settings.start_week.desc': 'Primer día de tu semana',
        'settings.date_format.label': 'Formato de Fecha',
        'settings.date_format.desc': 'Cómo se muestran las fechas',
        'settings.time_format.label': 'Formato de Hora',
        'settings.time_format.desc': 'Reloj de 12 o 24 horas',

        // Settings - Notifications
        'settings.notifications.title': 'Notificaciones',
        'settings.notifications.desc': 'Gestiona cómo recibes actualizaciones y recordatorios',
        'settings.daily_reminder.label': 'Recordatorio Diario',
        'settings.daily_reminder.desc': 'Recibe un recordatorio diario para revisar tus tareas',
        'settings.reminder_time.label': 'Hora del Recordatorio',
        'settings.reminder_time.desc': 'Cuándo enviar recordatorios diarios',
        'settings.routine_notif.label': 'Notificaciones de Rutina',
        'settings.routine_notif.desc': 'Alertas para tus rutinas programadas',
        'settings.project_deadlines.label': 'Plazos de Proyectos',
        'settings.project_deadlines.desc': 'Recordatorios para próximos plazos de proyectos',

        // Settings - Profile
        'settings.profile.title': 'Perfil',
        'settings.profile.desc': 'Gestiona tu información personal',
        'settings.display_name': 'Nombre para mostrar',
        'settings.email': 'Correo electrónico',
        'settings.password': 'Contraseña',
        'settings.change_password': 'Cambiar Contraseña',

        // Settings - Data
        'settings.data.title': 'Datos y Privacidad',
        'settings.data.desc': 'Controla tus datos y configuración de respaldo',
        'settings.auto_backup.label': 'Respaldo Automático',
        'settings.auto_backup.desc': 'Respaldar tus datos automáticamente',
        'settings.backup_freq.label': 'Frecuencia de Respaldo',
        'settings.backup_freq.desc': 'Con qué frecuencia respaldar tus datos',
        'settings.export.label': 'Exportar Datos',
        'settings.export.desc': 'Descarga todos tus datos como un archivo de respaldo JSON.',
        'settings.import.label': 'Importar Datos',
        'settings.import.desc': 'Restaura tus datos desde un archivo de respaldo JSON. Los datos existentes serán sobrescritos.',
        'settings.danger.label': 'Zona de Peligro',
        'settings.delete_all': 'Eliminar Todos los Datos',

        // Dashboard Greetings
        'greeting.morning': 'Buenos días',
        'greeting.afternoon': 'Buenas tardes',
        'greeting.evening': 'Buenas noches',

        // Sidebar - Section Titles
        'sidebar.overview': 'General',
        'sidebar.productivity': 'Productividad',
        'sidebar.life_growth': 'Vida y Crecimiento',

        // Sidebar - Items
        'sidebar.dashboard': 'Panel',
        'sidebar.today': 'Hoy',
        'sidebar.analytics': 'Analíticas',
        'sidebar.calendar': 'Calendario',
        'sidebar.ai': 'Asistente IA',
        'sidebar.focus': 'Enfoque',
        'sidebar.routines': 'Rutinas',
        'sidebar.checklist': 'Lista de Tareas',
        'sidebar.projects': 'Proyectos',
        'sidebar.trackers': 'Rastreadores',
        'sidebar.school': 'Escuela',
        'sidebar.business': 'Negocios',
        'sidebar.library': 'Biblioteca',
        'sidebar.social': 'Social',
        'sidebar.spiritual': 'Espiritual',
        'sidebar.appearance': 'Apariencia',
        'sidebar.music': 'Música',
        'sidebar.notes': 'Notas',
        'sidebar.pinned': 'Favoritos',
        'sidebar.settings': 'Configuración',
        'sidebar.logout': 'Cerrar sesión',
        'sidebar.life_context': 'Contexto Vital',
        'sidebar.cognitive_engine': 'Motor Cognitivo',
    },
    fr: {
        // Settings - Appearance
        'settings.appearance.title': 'Apparence',
        'settings.appearance.desc': 'Personnaliser l\'apparence de Novo',
        'settings.language.label': 'Langue',
        'settings.language.desc': 'Langue de l\'interface',

        'sidebar.life_context': 'Contexte de vie',
        'sidebar.cognitive_engine': 'Moteur Cognitif',

        // Dashboard Greetings
        'greeting.morning': 'Bonjour',
        'greeting.afternoon': 'Bon après-midi',
        'greeting.evening': 'Bonsoir',

        // Settings - General
        'settings.general.desc': 'Préférences régionales et de format',

        // Sidebar
        'sidebar.overview': 'Aperçu',
        'sidebar.productivity': 'Productivité',
        'sidebar.life_growth': 'Vie et Croissance',
        'sidebar.dashboard': 'Tableau de bord',
        'sidebar.settings': 'Paramètres',
        'sidebar.logout': 'Déconnexion',
    },
    de: {
        // Settings - Appearance
        'settings.appearance.title': 'Aussehen',
        'settings.appearance.desc': 'Passen Sie das Erscheinungsbild von Novo an',
        'settings.language.label': 'Sprache',
        'settings.language.desc': 'Oberflächensprache',

        // Dashboard Greetings
        'greeting.morning': 'Guten Morgen',
        'greeting.afternoon': 'Guten Tag',
        'greeting.evening': 'Guten Abend',

        // Settings - General
        'settings.general.desc': 'Regionale und Formateinstellungen',

        // Sidebar
        'sidebar.overview': 'Übersicht',
        'sidebar.productivity': 'Produktivität',
        'sidebar.life_growth': 'Leben & Wachstum',
        'sidebar.dashboard': 'Dashboard',
        'sidebar.settings': 'Einstellungen',
        'sidebar.logout': 'Abmelden',
    }
};

export function useTranslation() {
    const { settings } = useSettings();
    const language = (settings.language || 'en') as Language;

    const t = (key: string): string => {
        const langDict = translations[language] || translations['en'];
        return langDict[key] || translations['en'][key] || key;
    };

    return { t, language };
}
