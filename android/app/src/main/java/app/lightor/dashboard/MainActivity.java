package app.lightor.dashboard;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // LT-128/LT-129: mirrors AppDelegate.swift. Without google-services.json
        // the google-services Gradle plugin is not applied (see app/build.gradle),
        // so no default FirebaseApp exists and the capawesome plugins would throw
        // "Default FirebaseApp is not initialized" on load. A placeholder app lets
        // the shell run; push and native Google Sign-In fail cleanly instead.
        // NOTE: written without an Android SDK on the build Mac — untested until
        // Android Studio is installed.
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseOptions options = new FirebaseOptions.Builder()
                .setApplicationId("1:000000000000:android:0000000000000000")
                .setProjectId("placeholder")
                .setApiKey("AIza00000000000000000000000000000000000") // 39 chars, leading "A": the shape Firebase Installations validates
                .build();
            FirebaseApp.initializeApp(this, options);
            Log.w("Lightor", "google-services.json missing - Firebase running on placeholder options; push and Google Sign-In are off");
        }
        super.onCreate(savedInstanceState);
    }
}
