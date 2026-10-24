# Camera access guidance

Research checked on **2026-10-24** for the Pulse Painting camera-help interface in `app/camera-help.js`. The guidance should help a person recover camera access calmly, without suggesting that a refusal is a mistake or changing unrelated privacy settings.

This is documentation and source verification. It does not establish that every menu was exercised on a physical device. Browser, operating-system, language, device-management, and manufacturer versions can change labels and available controls.

## Browser and device permissions are separate

The website may need permission from the browser, and the browser app may separately need permission from the operating system. A successful change to one does not prove the other is enabled. A device-wide camera switch or a managed policy can also prevent access.

Prefer permission for **this site**. Do not recommend a blanket Allow for all websites, disabling tracking protection, clearing all browsing data, granting microphone access, or changing unrelated security settings. Pulse Painting needs camera access, not microphone access.

### Safari on iPhone and iPad

- On iPhone, open the Page Menu beside the address, choose Website Settings, then Camera and Allow for this website.
- On iPad, Apple documents Page Menu, then More, followed by the setting below Website Settings For. Combined instructions therefore mention Website Settings or More, depending on the version.
- If needed, open the device Settings, then Apps, Safari, and Camera. Choose **Ask** so Safari can request access. Older versions place Safari directly in Settings.
- Do not make the older `aA` icon the only way to identify Page Menu.
- Safari website camera settings should not be replaced with generic third-party-app permission instructions.

Official sources:

- [Apple: Safari privacy and camera settings on iPhone](https://support.apple.com/guide/iphone/iphb01fc3c85/ios)
- [Apple: Safari privacy and camera settings on iPad](https://support.apple.com/en-ca/guide/ipad/ipad8ea0fc1a/ipados)

### Chrome on Android

- Open Chrome's menu, Settings, Site settings, and Camera.
- Let sites ask to use the camera. If this website appears under Blocked, select it and choose Allow.
- Return to Pulse Painting and retry. The prompt wording can offer permission for this visit or this time.
- If browser settings are already correct, check Android's app-level camera permission and device-wide Camera access switch.

Official source: [Google: camera and microphone permissions in Chrome for Android](https://support.google.com/chrome/answer/2693767?hl=en&co=GENIE.Platform%3DAndroid).

### Chrome on iPhone and iPad

- If a camera icon appears left of the address bar, open it and turn the site's permission on.
- Google states that the icon appears only after the site's permission has changed. Its absence is not evidence that the camera is unavailable.
- If needed, open Settings, Privacy & Security, Camera, and enable Chrome if listed. Apps appear there after requesting camera access. If absent, return and make a deliberate camera attempt.
- Do not show Android's Site settings navigation to iPhone or iPad Chrome users.

Official sources:

- [Google: camera permissions in Chrome for iPhone and iPad](https://support.google.com/chrome/answer/2693767?co=GENIE.Platform%3DiOS&hl=en)
- [Apple: control access to hardware features](https://support.apple.com/guide/iphone/control-access-to-hardware-features-iph168c4bbd5/ios)

### Firefox on Android

- Open the menu, Settings, then Site settings. Older versions may call it Site permissions.
- Choose Camera, then Ask to allow.
- For a saved site block, open Exceptions, find this website, and clear its camera permission before trying again.
- If Firefox reports Blocked by Android, use the operating-system app permission instead.

Mozilla's current Android source was checked because its general support article includes desktop instructions that should not be copied wholesale into a mobile guide. The preference files and strings verify Site settings, Camera, Ask to allow, Exceptions, and Blocked by Android. Source links below track Mozilla's main branch and may change after this review.

Official sources:

- [Mozilla: Android settings preferences](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/mobile/android/fenix/app/src/main/res/xml/preferences.xml)
- [Mozilla: Android site permission preferences](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/mobile/android/fenix/app/src/main/res/xml/site_permissions_preferences.xml)
- [Mozilla: Android interface strings](https://raw.githubusercontent.com/mozilla-firefox/firefox/main/mobile/android/fenix/app/src/main/res/values/strings.xml)
- [Mozilla: camera and microphone permission support](https://support.mozilla.org/en-US/kb/how-manage-your-camera-and-microphone-permissions)

These instructions concern Firefox for Android, not Firefox Focus or Klar, which can have different navigation.

### Samsung Internet

- Open the lock or site-information control beside the address and allow Camera if that setting is present.
- Otherwise, look under Menu, Settings, Sites and downloads, and Site permissions. Labels vary by version.
- Check Samsung Internet's Android app permission if the site control does not resolve access.

Evidence boundary: Samsung's current support page verifies the Site permissions navigation in an article about cookies. Its camera controls are documented by official feature announcements from earlier releases. Combining these sources supports the qualified guidance, but does not certify a particular current camera submenu on a physical Samsung phone.

Official sources:

- [Samsung: Site permissions navigation](https://www.samsung.com/us/support/troubleshoot/TSG10007306/)
- [Samsung: per-site camera switches from the address-bar lock](https://news.samsung.com/in/samsung-internet-19-0-beta-is-now-available)
- [Samsung developer documentation: site permission settings](https://developer.samsung.com/browser/blog/en/2021/05/05/samsung-internet-142-beta)

### Operating-system fallback

- **iPhone/iPad, third-party browser apps:** Settings, Privacy & Security, Camera, then the browser. Only apps that have requested permission are listed.
- **Android:** Settings, Apps, the browser, Permissions, Camera, then Allow only while using the app. Exact labels vary by manufacturer.
- **Android 12 and later:** if a Camera access control exists in Quick Settings, it also needs to be on. Not every device presents the same tile or navigation.
- **Restricted settings:** if a control is unavailable, a parent or device administrator may need to help. Do not instruct users to bypass managed restrictions.

Official sources:

- [Apple: hardware permissions](https://support.apple.com/guide/iphone/control-access-to-hardware-features-iph168c4bbd5/ios)
- [Google: change Android app permissions](https://support.google.com/android/answer/9431959?hl=en)
- [Google: Android camera and microphone privacy controls](https://support.google.com/android/answer/13532937?hl=en)
- [Samsung: app permission management](https://www.samsung.com/us/support/answer/ANS10002544/)
- [Apple: Screen Time content and privacy restrictions](https://support.apple.com/en-la/105121)
- The Chrome Android permission article above also documents administrator-controlled camera settings.

## Explain the observed problem, not an assumed cause

`NotAllowedError` is not proof that a person pressed Deny. Site or device permission, insecure context, browser policy, and an embedded document's permission policy can prevent access. Permission copy should say that access is not available yet and that settings **may** help.

An unanswered permission prompt can leave `getUserMedia()` pending indefinitely. A waiting state must not become a denial claim merely because time passed. While a request remains pending, do not start competing requests or show a retry that silently duplicates it.

`NotReadableError` means the camera could not be opened even though access may have been allowed; another camera user or a hardware/browser failure is a possibility, not a proven diagnosis. `NotFoundError` concerns matching devices, and `OverconstrainedError` concerns requested constraints. These deserve different recovery copy from permission failures.

Camera capture requires a secure context. Production should use HTTPS; localhost is a development exception. A page embedded in another document may also require the appropriate camera Permissions Policy. Settings instructions alone cannot repair these integration conditions.

Technical primary sources:

- [MDN: MediaDevices.getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: camera Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera)

## Detection, illustrations, and interaction

- User-agent checks supply an initial **suggestion**, not authoritative identification. Keep a visible browser selector and preserve the person's explicit selection. Unknown browsers must have a generic fallback.
- Suspected in-app browser detection should open an optional “Opened inside another app?” explanation. Do not claim that every in-app browser is unsupported. Offer copying the canonical `https://www.pulsepainting.com/` link into a full browser.
- The small SVG diagrams are **illustrations**, not screenshots of a specific OS release and not functional browser controls. Keep explanatory text beside them and state that the browser may look different. Use SVG interface icons, not emoji.
- Help must not automatically request permission, alter settings, resume capture, or retry when someone returns from another app. Only an explicit user action may call the app's retry/start callback.
- Do not offer a fake native-settings deep link. “Camera settings” reveals guidance; “Try camera again” is a real action, subject to the app's request lifecycle guards.
- The app must stop any late-arriving stream from a cancelled request and must not assume that opening settings changed permissions.
- Offer a clear way to close help. If a painting already exists, preserve an explicit keep option and explain when starting another reading replaces it.

## Verification and limits

Review of `app/camera-help.js` against these sources found the browser paths appropriately qualified, site and device permissions separated, and browser detection overridable. The permission heading does not assert that the person denied access. Samsung's wording deliberately avoids promising a precise version-independent camera submenu.

Browser replay can verify rendering, keyboard and focus behavior, error routing, manual selection, cancelled requests, and retry lifecycle. It cannot verify real OS settings navigation, actual camera permission prompts, rear-camera/flash capability, or device policies. Those require physical-phone checks and should be reported separately from automated tests, local builds, and deployments.

Recheck this document when changing browser support or UI navigation. A physical verification pass should include Safari on iPhone, Chrome on Android, and whichever additional browsers are claimed as device-verified; exercise site denial, OS denial where applicable, a prompt left unanswered, cancellation, return from settings, and a successful fresh camera start.
