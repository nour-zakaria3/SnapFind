export type Lang = 'ar' | 'en';

const strings: Record<Lang, Record<string, string>> = {
  ar: {
    app_title: 'أرشيف الصور',
    login: 'تسجيل الدخول',
    signup: 'إنشاء حساب',
    logout: 'تسجيل الخروج',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    upload: 'رفع صور',
    search_placeholder: 'ابحث بكلمة في الصورة أو بوصف لها…',
    search: 'بحث',
    folders: 'المجلدات',
    all_images: 'كل الصور',
    new_folder: 'مجلد جديد',
    trash: 'سلة المحذوفات',
    restore: 'استعادة',
    move_to_trash: 'نقل إلى السلة',
    agent_title: 'المساعد الذكي',
    agent_placeholder: 'مثال: ضع صور الفواتير في مجلد واحد',
    agent_run: 'اقترح خطة',
    agent_confirm: 'تأكيد التنفيذ',
    agent_cancel: 'إلغاء',
    agent_quota: 'تم استهلاك الحصة المجانية للمساعد، حاول لاحقاً.',
    pending: 'قيد الفهرسة',
    upload_failed: 'تعذّر رفع بعض الملفات',
    language: 'English',
  },
  en: {
    app_title: 'Image Archive',
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    email: 'Email',
    password: 'Password',
    upload: 'Upload images',
    search_placeholder: 'Search by text in the image or describe it…',
    search: 'Search',
    folders: 'Folders',
    all_images: 'All images',
    new_folder: 'New folder',
    trash: 'Trash',
    restore: 'Restore',
    move_to_trash: 'Move to trash',
    agent_title: 'Smart assistant',
    agent_placeholder: 'e.g. Put invoice photos in one folder',
    agent_run: 'Suggest a plan',
    agent_confirm: 'Confirm and run',
    agent_cancel: 'Cancel',
    agent_quota: 'The assistant free quota is used up, try again later.',
    pending: 'Indexing',
    upload_failed: 'Some files could not be uploaded',
    language: 'العربية',
  },
};

const STORAGE_KEY = 'lang';
let current: Lang = 'ar';

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  current = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* storage unavailable: ignore */
  }
}

export function loadSavedLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return 'ar';
}

export function t(key: string): string {
  return strings[current][key] ?? key;
}
