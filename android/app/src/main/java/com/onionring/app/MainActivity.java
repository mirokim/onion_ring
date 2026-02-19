package com.onionring.app;

import android.os.Bundle;
import android.os.PowerManager;
import android.net.wifi.WifiManager;
import android.content.Context;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep CPU active while debate is running (even with screen off)
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "OnionRing::DebateWakeLock"
        );

        // Keep Wi-Fi active while debate is running
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        wifiLock = wm.createWifiLock(
            WifiManager.WIFI_MODE_FULL_HIGH_PERF,
            "OnionRing::DebateWifiLock"
        );
    }

    @Override
    public void onResume() {
        super.onResume();
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(60 * 60 * 1000L); // Max 1 hour
        }
        if (wifiLock != null && !wifiLock.isHeld()) {
            wifiLock.acquire();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (wifiLock != null && wifiLock.isHeld()) {
            wifiLock.release();
        }
        super.onDestroy();
    }
}
