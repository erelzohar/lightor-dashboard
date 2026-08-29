abstract class Globals {
    public appointmentsUrl:string;
    public webConfigsUrl :string;
    public imagesUrl:string;
    public messagingUrl:string;
    public usersUrl:string;
    public typesUrl:string;
    public authUrl:string;
    public aiUrl:string;
    public paddleUrl:string;
    public entitlementsUrl:string;
    public instagramUrl:string;
    public calendarUrl:string;
    public adminUrl:string;
    /** The register app's ORIGIN (no path) — same site as the dashboard. */
    public registerOrigin:string;
}

// Overridable so a local dashboard can target a backend on a non-default
// port (e.g. when :3000 is taken by another checkout). Dev-only: the
// production class below stays hardcoded on purpose (the LT-027 lesson —
// an env leaking into prod bounced local runs into production).
const DEV_API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:3000";

class DevelopmentGlobals extends Globals {
    public appointmentsUrl = `${DEV_API_BASE}/api/appointments/`;
    public webConfigsUrl = `${DEV_API_BASE}/api/web-configs/`;
    public vacationsUrl = `${DEV_API_BASE}/api/vacations/`;
    public messagingUrl = `${DEV_API_BASE}/api/messaging/`;
    public usersUrl = `${DEV_API_BASE}/api/users/`;
    public typesUrl = `${DEV_API_BASE}/api/appointment-types/`;
    public authUrl = `${DEV_API_BASE}/api/auth/`;
    public imagesUrl = `${DEV_API_BASE}/api/images/`;
    public aiUrl = `${DEV_API_BASE}/api/ai/`;
    public paddleUrl = `${DEV_API_BASE}/api/paddle/`;
    public entitlementsUrl = `${DEV_API_BASE}/api/entitlements/`;
    public instagramUrl = `${DEV_API_BASE}/api/instagram/`;
    public calendarUrl = `${DEV_API_BASE}/api/calendar/`;
    public adminUrl = `${DEV_API_BASE}/api/admin/`;
    public registerOrigin = "http://localhost:5173";
}

// class ProductionGlobals extends Globals {
//     public appointmentsUrl = "https://ez-lines-back.onrender.com/api/appointments/";
//     public webConfigsUrl = "https://ez-lines-back.onrender.com/api/web-configs/";
//     public authUrl = "https://ez-lines-back.onrender.com/api/auth/";
//     public usersUrl = "https://ez-lines-back.onrender.com/api/users/";
//     public messagingUrl = "https://ez-lines-back.onrender.com/api/messaging/";
//     public imagesUrl = "https://ez-lines-back.onrender.com/api/images/";
//     public typesUrl = "https://ez-lines-back.onrender.com/api/appointment-types/";
// }

// class ProductionGlobals extends Globals {
//     public appointmentsUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/appointments/";
//     public webConfigsUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/web-configs/";
//     public vacationsUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/vacations/";
//     public authUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/auth/";
//     public usersUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/users/";
//     public messagingUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/messaging/";
//     public imagesUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/images/";
//     public typesUrl = "https://ez-lines-server-84870f3974b9.herokuapp.com/api/appointment-types/";
// }
class ProductionGlobals extends Globals {
    public appointmentsUrl = "https://api.lightor.app/api/appointments/";
    public webConfigsUrl = "https://api.lightor.app/api/web-configs/";
    public vacationsUrl = "https://api.lightor.app/api/vacations/";
    public authUrl = "https://api.lightor.app/api/auth/";
    public usersUrl = "https://api.lightor.app/api/users/";
    public messagingUrl = "https://api.lightor.app/api/messaging/";
    public imagesUrl = "https://api.lightor.app/api/images/";
    public typesUrl = "https://api.lightor.app/api/appointment-types/";
    public aiUrl = "https://api.lightor.app/api/ai/";
    public paddleUrl = "https://api.lightor.app/api/paddle/";
    public entitlementsUrl = "https://api.lightor.app/api/entitlements/";
    public instagramUrl = "https://api.lightor.app/api/instagram/";
    public calendarUrl = "https://api.lightor.app/api/calendar/";
    public adminUrl = "https://api.lightor.app/api/admin/";
    public registerOrigin = "https://register.lightor.app";
}
// class ProductionGlobals extends Globals {
//     public appointmentsUrl = "https://api.ez-lines.com/api/appointments/";
//     public webConfigsUrl = "https://api.ez-lines.com/api/web-configs/";
//     public vacationsUrl = "https://api.ez-lines.com/api/vacations/";
//     public authUrl = "https://api.ez-lines.com/api/auth/";
//     public usersUrl = "https://api.ez-lines.com/api/users/";
//     public messagingUrl = "https://api.ez-lines.com/api/messaging/";
//     public imagesUrl = "https://api.ez-lines.com/api/images/";
//     public typesUrl = "https://api.ez-lines.com/api/appointment-types/";
// }

const globals = process.env.NODE_ENV === "production" ? new ProductionGlobals() : new DevelopmentGlobals();

export default globals;
