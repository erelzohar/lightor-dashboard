import { AppointmentType, Appointment } from '../types';

/* ════════════════════════════════════════════════════════════════════════════
 *  ⚠️  DUMMY DATA — NOT REAL. REMOVE BEFORE PRODUCTION.  (mission LT-021)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Everything exported from this file is fabricated. One consumer remains:
 *
 *   1. store/slices/appointmentsSlice.ts — DISABLED via USE_MOCK_DATA = false.
 *      Previously seeded the Redux initial state, so the calendar, appointment
 *      list and revenue/statistics widgets rendered fake rows until a real
 *      fetch replaced them — and kept them if the fetch failed.
 *   2. contexts/ThemeContext.tsx — GONE (LT-021). It now owns a DEFAULT_PALETTE
 *      constant (value-identical, Lightor brand colours) instead of reading
 *      them off a fabricated business record.
 *   3. services/userApi.ts — GONE (LT-021). The fake login (hardcoded
 *      credentials + canned JWT) and the dead userSlice thunks that referenced
 *      it were deleted outright.
 * ════════════════════════════════════════════════════════════════════════════ */

// Set to true to pre-load mock appointments & appointment types on app start.
// OFF: the appointment state now starts empty and only ever shows what the API
// actually returned, so a failed fetch reads as empty rather than as somebody
// else's invented bookings.
export const USE_MOCK_DATA = false;

if (USE_MOCK_DATA && typeof console !== 'undefined') {
  console.warn(
    '%c⚠️ DUMMY DATA ACTIVE',
    'background:#b45309;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold',
    '\nAppointments and appointment types are seeded from src/utils/mockData.ts.' +
    '\nAnything shown before a real API fetch resolves is fabricated. (LT-021)'
  );
}

// ── Helper: compute epoch timestamp for day offset + time ──────────────────
const ts = (daysOffset: number, hour: number, minute = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return String(d.getTime());
};

// ── Appointment types ──────────────────────────────────────────────────────
export const MOCK_APPOINTMENT_TYPES: AppointmentType[] = [
  { _id: 'type_001', name: 'מניקור קלאסי',        webConfig_id: 'cfg_001', price: '80',  durationMS: '1800000' }, // 30 min
  { _id: 'type_002', name: 'פדיקור רפואי',         webConfig_id: 'cfg_001', price: '120', durationMS: '3600000' }, // 60 min
  { _id: 'type_003', name: 'לק ג\'ל',              webConfig_id: 'cfg_001', price: '180', durationMS: '2700000' }, // 45 min
  { _id: 'type_004', name: 'מניקור יפני',           webConfig_id: 'cfg_001', price: '200', durationMS: '3600000' }, // 60 min
  { _id: 'type_005', name: 'ציפורניים אקרילי',     webConfig_id: 'cfg_001', price: '250', durationMS: '5400000' }, // 90 min
  { _id: 'type_006', name: 'טיפול ספא רגליים',     webConfig_id: 'cfg_001', price: '160', durationMS: '4500000' }, // 75 min
];

const [T1, T2, T3, T4, T5, T6] = MOCK_APPOINTMENT_TYPES;

// ── Mock appointments: ~45 entries spread across 3 weeks ──────────────────
export const MOCK_APPOINTMENTS: Appointment[] = [
  // ── 7 days ago ──────────────────────────────────────────────────────────
  { _id: 'a001', name: 'מיכל לוי',      type: T1, phone: '+972501234567', status: 'completed', user_id: 'u001', timestamp: ts(-7, 10, 0)  },
  { _id: 'a002', name: 'דנה כהן',       type: T3, phone: '+972521234568', status: 'completed', user_id: 'u001', timestamp: ts(-7, 11, 30) },
  { _id: 'a003', name: 'שירה אברהם',    type: T2, phone: '+972541234569', status: 'completed', user_id: 'u001', timestamp: ts(-7, 14, 0)  },

  // ── 6 days ago ──────────────────────────────────────────────────────────
  { _id: 'a004', name: 'רות מזרחי',     type: T4, phone: '+972531234570', status: 'completed', user_id: 'u001', timestamp: ts(-6, 10, 30) },
  { _id: 'a005', name: 'נועה ביטון',    type: T1, phone: '+972511234571', status: 'cancelled', user_id: 'u001', timestamp: ts(-6, 12, 0)  },
  { _id: 'a006', name: 'יעל שפירא',     type: T5, phone: '+972561234572', status: 'completed', user_id: 'u001', timestamp: ts(-6, 15, 0)  },

  // ── 5 days ago ──────────────────────────────────────────────────────────
  { _id: 'a007', name: 'אורית גולן',    type: T6, phone: '+972571234573', status: 'completed', user_id: 'u001', timestamp: ts(-5, 9, 0)   },
  { _id: 'a008', name: 'תמר פרץ',       type: T3, phone: '+972581234574', status: 'completed', user_id: 'u001', timestamp: ts(-5, 11, 0)  },
  { _id: 'a009', name: 'ליאת בן-דוד',  type: T2, phone: '+972591234575', status: 'completed', user_id: 'u001', timestamp: ts(-5, 13, 30) },

  // ── 4 days ago ──────────────────────────────────────────────────────────
  { _id: 'a010', name: 'חגית מור',      type: T1, phone: '+972501234576', status: 'completed', user_id: 'u001', timestamp: ts(-4, 10, 0)  },
  { _id: 'a011', name: 'רחל גרוס',      type: T4, phone: '+972521234577', status: 'cancelled', user_id: 'u001', timestamp: ts(-4, 11, 30) },
  { _id: 'a012', name: 'מרים ניסים',    type: T3, phone: '+972541234578', status: 'completed', user_id: 'u001', timestamp: ts(-4, 14, 0)  },
  { _id: 'a013', name: 'הדס שלום',      type: T6, phone: '+972531234579', status: 'completed', user_id: 'u001', timestamp: ts(-4, 16, 0)  },

  // ── 3 days ago ──────────────────────────────────────────────────────────
  { _id: 'a014', name: 'ענת קפלן',      type: T2, phone: '+972511234580', status: 'completed', user_id: 'u001', timestamp: ts(-3, 9, 30)  },
  { _id: 'a015', name: 'שרית חיים',     type: T5, phone: '+972561234581', status: 'completed', user_id: 'u001', timestamp: ts(-3, 12, 0)  },
  { _id: 'a016', name: 'גלית עמר',      type: T1, phone: '+972571234582', status: 'cancelled', user_id: 'u001', timestamp: ts(-3, 15, 0)  },

  // ── 2 days ago ──────────────────────────────────────────────────────────
  { _id: 'a017', name: 'כרמלה מנשה',   type: T3, phone: '+972581234583', status: 'completed', user_id: 'u001', timestamp: ts(-2, 10, 0)  },
  { _id: 'a018', name: 'אביבה שוחט',   type: T6, phone: '+972591234584', status: 'completed', user_id: 'u001', timestamp: ts(-2, 11, 30) },
  { _id: 'a019', name: 'מיכל לוי',     type: T4, phone: '+972501234567', status: 'completed', user_id: 'u001', timestamp: ts(-2, 14, 0)  },
  { _id: 'a020', name: 'דנה כהן',      type: T2, phone: '+972521234568', status: 'completed', user_id: 'u001', timestamp: ts(-2, 16, 30) },

  // ── Yesterday ───────────────────────────────────────────────────────────
  { _id: 'a021', name: 'נועה ביטון',   type: T1, phone: '+972511234571', status: 'completed', user_id: 'u001', timestamp: ts(-1, 10, 0)  },
  { _id: 'a022', name: 'שירה אברהם',   type: T5, phone: '+972541234569', status: 'completed', user_id: 'u001', timestamp: ts(-1, 11, 30) },
  { _id: 'a023', name: 'יעל שפירא',    type: T3, phone: '+972561234572', status: 'completed', user_id: 'u001', timestamp: ts(-1, 13, 0)  },
  { _id: 'a024', name: 'רות מזרחי',    type: T6, phone: '+972531234570', status: 'cancelled', user_id: 'u001', timestamp: ts(-1, 15, 0)  },
  { _id: 'a025', name: 'חגית מור',     type: T2, phone: '+972501234576', status: 'completed', user_id: 'u001', timestamp: ts(-1, 16, 0)  },

  // ── Today ───────────────────────────────────────────────────────────────
  { _id: 'a026', name: 'ליאת בן-דוד',  type: T1, phone: '+972591234575', status: 'completed', user_id: 'u001', timestamp: ts(0, 9, 0)   },
  { _id: 'a027', name: 'תמר פרץ',      type: T4, phone: '+972581234574', status: 'completed', user_id: 'u001', timestamp: ts(0, 10, 30) },
  { _id: 'a028', name: 'אורית גולן',   type: T6, phone: '+972571234573', status: 'scheduled', user_id: 'u001', timestamp: ts(0, 12, 0)  },
  { _id: 'a029', name: 'שרית חיים',    type: T3, phone: '+972561234581', status: 'scheduled', user_id: 'u001', timestamp: ts(0, 14, 0)  },
  { _id: 'a030', name: 'מרים ניסים',   type: T5, phone: '+972541234578', status: 'scheduled', user_id: 'u001', timestamp: ts(0, 15, 30) },
  { _id: 'a031', name: 'ענת קפלן',     type: T2, phone: '+972511234580', status: 'scheduled', user_id: 'u001', timestamp: ts(0, 17, 0)  },

  // ── Tomorrow ────────────────────────────────────────────────────────────
  { _id: 'a032', name: 'גלית עמר',     type: T1, phone: '+972571234582', status: 'scheduled', user_id: 'u001', timestamp: ts(1, 10, 0)  },
  { _id: 'a033', name: 'כרמלה מנשה',   type: T3, phone: '+972581234583', status: 'scheduled', user_id: 'u001', timestamp: ts(1, 11, 30) },
  { _id: 'a034', name: 'אביבה שוחט',   type: T4, phone: '+972591234584', status: 'scheduled', user_id: 'u001', timestamp: ts(1, 13, 0)  },
  { _id: 'a035', name: 'רחל גרוס',     type: T2, phone: '+972521234577', status: 'scheduled', user_id: 'u001', timestamp: ts(1, 15, 0)  },

  // ── Day +2 ──────────────────────────────────────────────────────────────
  { _id: 'a036', name: 'מיכל לוי',     type: T5, phone: '+972501234567', status: 'scheduled', user_id: 'u001', timestamp: ts(2, 9, 30)  },
  { _id: 'a037', name: 'הדס שלום',     type: T1, phone: '+972531234579', status: 'scheduled', user_id: 'u001', timestamp: ts(2, 11, 0)  },
  { _id: 'a038', name: 'יעל שפירא',    type: T6, phone: '+972561234572', status: 'scheduled', user_id: 'u001', timestamp: ts(2, 14, 30) },

  // ── Day +3 ──────────────────────────────────────────────────────────────
  { _id: 'a039', name: 'דנה כהן',      type: T3, phone: '+972521234568', status: 'scheduled', user_id: 'u001', timestamp: ts(3, 10, 0)  },
  { _id: 'a040', name: 'נועה ביטון',   type: T4, phone: '+972511234571', status: 'scheduled', user_id: 'u001', timestamp: ts(3, 12, 0)  },
  { _id: 'a041', name: 'ליאת בן-דוד',  type: T2, phone: '+972591234575', status: 'cancelled', user_id: 'u001', timestamp: ts(3, 13, 30) },
  { _id: 'a042', name: 'שירה אברהם',   type: T1, phone: '+972541234569', status: 'scheduled', user_id: 'u001', timestamp: ts(3, 15, 0)  },

  // ── Day +4 ──────────────────────────────────────────────────────────────
  { _id: 'a043', name: 'תמר פרץ',      type: T6, phone: '+972581234574', status: 'scheduled', user_id: 'u001', timestamp: ts(4, 11, 0)  },
  { _id: 'a044', name: 'חגית מור',     type: T5, phone: '+972501234576', status: 'scheduled', user_id: 'u001', timestamp: ts(4, 14, 0)  },

  // ── Day +5 ──────────────────────────────────────────────────────────────
  { _id: 'a045', name: 'אורית גולן',   type: T3, phone: '+972571234573', status: 'scheduled', user_id: 'u001', timestamp: ts(5, 10, 0)  },
  { _id: 'a046', name: 'רות מזרחי',    type: T1, phone: '+972531234570', status: 'scheduled', user_id: 'u001', timestamp: ts(5, 12, 30) },
  { _id: 'a047', name: 'כרמלה מנשה',   type: T4, phone: '+972581234583', status: 'scheduled', user_id: 'u001', timestamp: ts(5, 15, 0)  },

  // ── Day +6 ──────────────────────────────────────────────────────────────
  { _id: 'a048', name: 'גלית עמר',     type: T2, phone: '+972571234582', status: 'scheduled', user_id: 'u001', timestamp: ts(6, 11, 0)  },
  { _id: 'a049', name: 'שרית חיים',    type: T6, phone: '+972561234581', status: 'scheduled', user_id: 'u001', timestamp: ts(6, 13, 0)  },

  // ── Day +7 ──────────────────────────────────────────────────────────────
  { _id: 'a050', name: 'ענת קפלן',     type: T5, phone: '+972511234580', status: 'scheduled', user_id: 'u001', timestamp: ts(7, 10, 0)  },
  { _id: 'a051', name: 'מרים ניסים',   type: T3, phone: '+972541234578', status: 'scheduled', user_id: 'u001', timestamp: ts(7, 12, 0)  },
  { _id: 'a052', name: 'אביבה שוחט',   type: T1, phone: '+972591234584', status: 'scheduled', user_id: 'u001', timestamp: ts(7, 14, 30) },
];

// ── Web Config ─────────────────────────────────────────────────────────────
// MOCK_WEB_CONFIG and MOCK_USER used to live here. Their last consumers died
// in LT-021 (ThemeContext grew its own DEFAULT_PALETTE; the fake login was
// deleted), so the fabricated business record and its owner are gone too.
