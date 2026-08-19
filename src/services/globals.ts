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
}

class DevelopmentGlobals extends Globals {
    public appointmentsUrl = "http://localhost:3000/api/appointments/";
    public webConfigsUrl = "http://localhost:3000/api/web-configs/";
    public vacationsUrl = "http://localhost:3000/api/vacations/";
    public messagingUrl = "http://localhost:3000/api/messaging/";
    public usersUrl = "http://localhost:3000/api/users/";
    public typesUrl = "http://localhost:3000/api/appointment-types/";
    public authUrl = "http://localhost:3000/api/auth/";
    public imagesUrl = "http://localhost:3000/api/images/";
    public aiUrl = "http://localhost:3000/api/ai/";
    public paddleUrl = "http://localhost:3000/api/paddle/";
    public entitlementsUrl = "http://localhost:3000/api/entitlements/";
    public instagramUrl = "http://localhost:3000/api/instagram/";
    public calendarUrl = "http://localhost:3000/api/calendar/";
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
