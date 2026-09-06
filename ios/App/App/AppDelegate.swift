import UIKit
import Capacitor
import FirebaseCore
import FirebaseAuth

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // LT-128/LT-129: Firebase (native Google Sign-In + FCM push) is only
        // configured when its config file is present. GoogleService-Info.plist
        // is git-ignored and not in the repo yet, and the app must still build,
        // launch and serve email/password login without it. The web layer
        // try/catches every plugin call for the same reason.
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        } else {
            // The capawesome plugins call FirebaseApp.configure() themselves on
            // load when no app exists yet, and that throws (uncaught, fatal)
            // without the plist — verified in the simulator. Configuring a
            // placeholder app first makes them skip it; their sign-in/token
            // calls then fail cleanly and the web layer's try/catch handles it.
            let placeholder = FirebaseOptions(
                googleAppID: "1:000000000000:ios:0000000000000000",
                gcmSenderID: "000000000000"
            )
            placeholder.projectID = "placeholder"
            // Installations validates only the shape (39 chars, leading "A"); the
            // value must NOT look like a real key or GitHub secret scanning flags it.
            placeholder.apiKey = "APLACEHOLDER-NOT-A-REAL-KEY-00000000000"
            FirebaseApp.configure(options: placeholder)
            NSLog("Lightor: GoogleService-Info.plist missing — Firebase running on placeholder options; push and Google Sign-In are off")
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet played) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    // MARK: - URL handling (Google Sign-In callback, custom schemes)

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // @capacitor-firebase/authentication + messaging both installed: let
        // FirebaseAuth claim its own callback URLs first (plugin README).
        // Auth.auth() would crash before FirebaseApp.configure(), so guard on
        // the same condition as above.
        if FirebaseApp.app() != nil, Auth.auth().canHandle(url) {
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Universal links (dashboard.lightor.app/verify/*, /handoff, ...) reach
        // the web layer as @capacitor/app `appUrlOpen` events.
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - Push (APNs → FCM via @capacitor-firebase/messaging)

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name.init("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }
}
