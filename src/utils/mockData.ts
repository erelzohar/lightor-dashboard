import { WebConfig, User, AppointmentType, Appointment } from '../types';

export const MOCK_WEB_CONFIG: WebConfig = {
  "_id": "6820e09d93a3878d15328b70",
  "user_id": "6820e53e93a3878d15328b7f",
  "businessName": "אנה קוסמטיקס - מניקור ופדיקור",
  "logoImageName": "https://images.unsplash.com/photo-1588776814546-ec7e8c54f05a?auto=format&fit=crop&q=80&w=800",
  "subDomain": "anna-nails",
  "minCancelTimeMS": 3600000,
  "defaultLanguage": "he",
  "workingDays": [
    null,
    "10:00-18:00",
    "10:00-18:00",
    "10:00-18:00",
    "10:00-18:00",
    "09:00-14:00",
    null
  ],
  "address": {
    "state": "ישראל",
    "city": "תל אביב",
    "street": "דיזנגוף 120",
    "other": "קומה 2, חדר 205"
  },
  "contact": {
    "phone": "+972541234567",
    "mail": "anna@beautyhub.com"
  },
  "social": {
    "instagram": "https://www.instagram.com/anna_nails_beauty",
    "facebook": "https://www.facebook.com/annanailsbeauty",
    "x": "https://twitter.com/annanails",
    "tiktok": "https://www.tiktok.com/@annanails"
  },
  "pallete": {
    "colorPrimary": "#8b5cf6",
    "colorPrimaryDark": "#06b6d4",
    "colorLightBg": "#ffffff",
    "colorLightSurface": "#ffffff",
    "colorLightGray": "#64748b",
    "colorLightText": "#1f2937",
    "colorDarkBg": "#1e293b",
    "colorDarkSurface": "#334155",
    "colorDarkGray": "#9ca3af",
    "colorDarkText": "#f9fafb"
  },
  "components": {
    "navbar": {
      "visible": true,
      "darkMode": true,
      "languageSwitcher": true
    },
    "hero": {
      "visible": true,
      "title": "יופי בקצות האצבעות",
      "subtitle": "טיפוח ציפורניים ברמה הגבוהה ביותר",
      "description": "גילוי מחדש של מניקור ופדיקור מקצועיים באווירה נעימה ואלגנטית. הידיים והרגליים שלך ראויות לטוב ביותר.",
      "heroImageSrc": "https://images.unsplash.com/photo-1588776814546-ec7e8c54f05a?auto=format&fit=crop&q=80&w=800"
    },
    "about": {
      "visible": true,
      "title": "אודות אנה קוסמטיקס",
      "description": "טיפוח יוקרתי ונעים שמתאים לכל סגנון ולכל אירוע.",
      "paragraphs": {
        "intro": "ברוכים הבאים לאנה קוסמטיקס – סטודיו בוטיק לטיפוח הציפורניים בלב תל אביב. מאז 2019 אנחנו מציעות חוויה מקצועית, מוקפדת ואישית לכל לקוחה.",
        "mission": "המשימה שלנו היא לשלב בין אסתטיקה, נוחות ובריאות. עם טכנאיות מוסמכות, חומרים איכותיים ושירות מכל הלב – תרגישי בבית מהרגע הראשון."
      },
      "features": [
        {
          "icon": "Sparkles",
          "title": "סטריליות ובטיחות",
          "description": "כל הכלים עוברים חיטוי קפדני, ואנחנו משתמשות במוצרים מהמותגים המובילים בלבד."
        },
        {
          "icon": "Hand",
          "title": "עיצובים אישיים",
          "description": "מהמראה הקלאסי ועד לאמנות ציפורניים מקורית – אצלנו כל אחת מוצאת את הסגנון שלה."
        },
        {
          "icon": "Smile",
          "title": "לקוחות מרוצות",
          "description": "מאות לקוחות חוזרות בכל חודש. השביעות רצון שלכן היא ההשראה שלנו!"
        }
      ]
    },
    "portfolio": {
      "visible": true,
      "isGrid": true,
      "title": "העבודות שלנו",
      "description": "הציצי בגלריית העבודות שלנו ותראי איך אנחנו הופכות כל זוג ידיים ליצירת אמנות.",
      "items": [
        {
          "url": "https://images.unsplash.com/photo-1588776814546-ec7e8c54f05a?auto=format&fit=crop&q=80&w=800",
          "title": "פרנץ' קלאסי",
          "description": "המראה האלגנטי שתמיד באופנה"
        },
        {
          "url": "https://images.unsplash.com/photo-1626360884020-75ef0421aaff?auto=format&fit=crop&q=80&w=800",
          "title": "צבעים עזים",
          "description": "לנשים שלא מפחדות לבלוט"
        },
        {
          "url": "https://images.unsplash.com/photo-1611930021560-7e76ce219a65?auto=format&fit=crop&q=80&w=800",
          "title": "ניוד מושלם",
          "description": "גוונים עדינים וקלאסיים ליומיום"
        },
        {
          "url": "https://images.unsplash.com/photo-1600180758890-6a3b9df9c41e?auto=format&fit=crop&q=80&w=800",
          "title": "נצנוץ לחגים",
          "description": "סטייל מיוחד לערב או לאירוע"
        },
        {
          "url": "https://images.unsplash.com/photo-1580130376552-0e7b0fd07d55?auto=format&fit=crop&q=80&w=800",
          "title": "שיק מינימליסטי",
          "description": "פשטות אלגנטית ונקייה"
        },
        {
          "url": "https://images.unsplash.com/photo-1599942634394-2d6a5d73317b?auto=format&fit=crop&q=80&w=800",
          "title": "אמנות בציפורניים",
          "description": "עיצובים מיוחדים בהתאמה אישית"
        }
      ]
    },
    "schedule": {
      "title": "קביעת תור",
      "description": "בחרי את השירות שמתאים לך, מתי שנוח – ונשמח לראות אותך בסטודיו!",
      "vacations": [
        "1755553-17852554"
      ],
      "minsPerAppo": 30,
      "appointmentTypes": [
        "68237f9a44d5a7b474ddcba0",
        "68237fb644d5a7b474ddcba1",
        "68237fc844d5a7b474ddcba2"
      ]
    },
    "contact": {
      "visible": true,
      "title": "צרי קשר",
      "description": "רוצה לשאול שאלה או לבדוק זמינות? שלחי לנו הודעה ונחזור אליך בהקדם!"
    },
    "footer": {
      "visible": true,
      "description": "טיפוח ציפורניים מקצועי עם אהבה, סטריליות וסטייל. איתנו תרגישי מושלמת – מהקצה ועד הקצה."
    },
    "introPopup": {
      "visible": true,
      "value": "לקוחות יקרות, הסטודיו יהיה סגור בין התאריכים 10.8–15.8 עקב חופשה. תודה על ההבנה!"
    },
    "contactButton": {
      "visible": true
    }
  }
};

export const MOCK_USER: User = {
  "_id": "6820e53e93a3878d15328b7f",
  "username": "anna_admin",
  "password": "סיסמא456!",
  "webConfig_id": "6820e09d93a3878d15328b70",
  "email": "admin@annacosmetics.co.il",
  "phone": "+972501112223",
  "subscription": "premium",
  "name": "אנה קוסמטיקס",
  "defaultLanguage": "he"
};

export const MOCK_APPOINTMENT_TYPES: AppointmentType[] = [
  {
    "_id": "68237f9a44d5a7b474ddcba0",
    "name": "מניקור קלאסי",
    "user_id": "6820e53e93a3878d15328b7f",
    "price": "80",
    "durationMS": "1800000"
  },
  {
    "_id": "68237fb644d5a7b474ddcba1",
    "name": "פדיקור רפואי",
    "user_id": "6820e53e93a3878d15328b7f",
    "price": "120",
    "durationMS": "3600000"
  },
  {
    "_id": "68237fc844d5a7b474ddcba2",
    "name": "לק ג'ל",
    "user_id": "6820e53e93a3878d15328b7f",
    "price": "180",
    "durationMS": "2700000"
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    "_id": "6823a010c0f993b61b7ab819",
    "name": "מיכל לוי",
    "type_id": "68237f9a44d5a7b474ddcba0",
    "phone": "+972501234567",
    "user_id": "6820e53e93a3878d15328b7f",
    "timestamp": String(new Date().setHours(10, 0, 0, 0))
  },
  {
    "_id": "6823a010c0f993b61b7ab820",
    "name": "דנה כהן",
    "type_id": "68237fb644d5a7b474ddcba1",
    "phone": "+972529876543",
    "user_id": "6820e53e93a3878d15328b7f",
    "timestamp": String(new Date().setHours(11, 0, 0, 0))
  },
  {
    "_id": "6823a010c0f993b61b7ab821",
    "name": "שירה אברהם",
    "type_id": "68237fc844d5a7b474ddcba2",
    "phone": "+972541234567",
    "user_id": "6820e53e93a3878d15328b7f",
    "timestamp": String(new Date().setHours(14, 0, 0, 0))
  }
];