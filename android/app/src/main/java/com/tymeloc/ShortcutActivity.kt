package com.tymeloc

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class ShortcutActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("tymeloc://applock")).apply {
      setPackage(packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    startActivity(intent)
    finish()
  }
}