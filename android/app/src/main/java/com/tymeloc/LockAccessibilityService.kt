package com.tymeloc

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.util.Log

class LockAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        // Only block if our LockService says we are currently locked
        if (!LockService.isRunning) return

        val packageName = event.packageName?.toString() ?: ""
        
        // List of packages to block (Settings and the Android Permission Controller)
        if (packageName.contains("com.android.settings") || 
            packageName.contains("com.google.android.permissioncontroller") ||
            packageName.contains("com.android.packageinstaller")) {
            
            Log.d("Tymeloc", "Blocked access to settings during lockdown")
            
            // Force the user back to the home screen
            performGlobalAction(GLOBAL_ACTION_HOME)
        }
    }

    override fun onInterrupt() {}
}
