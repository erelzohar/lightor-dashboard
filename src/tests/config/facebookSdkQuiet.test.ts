import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (file: string) => readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

/**
 * LT-643: the Facebook SDK is in the apps for sign-in only. By default it
 * sends app events to Meta and collects the advertising ID, which the App
 * Store and Play privacy answers say Lightor never does, and Play then asks
 * for an advertising ID declaration. Both stay off on both platforms.
 */
describe('the Facebook SDK sends nothing by itself', () => {
  it('iOS: no automatic app events, no advertising ID', () => {
    const plist = read('ios/App/App/Info.plist');
    expect(plist).toMatch(/<key>FacebookAutoLogAppEventsEnabled<\/key>\s*<false\/>/);
    expect(plist).toMatch(/<key>FacebookAdvertiserIDCollectionEnabled<\/key>\s*<false\/>/);
  });

  it('Android: no automatic app events, no advertising ID', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toMatch(/com\.facebook\.sdk\.AutoLogAppEventsEnabled" android:value="false"/);
    expect(manifest).toMatch(/com\.facebook\.sdk\.AdvertiserIDCollectionEnabled" android:value="false"/);
  });

  it('Android: the ad permissions the SDK adds are removed', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    for (const permission of [
      'com.google.android.gms.permission.AD_ID',
      'android.permission.ACCESS_ADSERVICES_AD_ID',
      'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
      'android.permission.ACCESS_ADSERVICES_TOPICS',
      'android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE',
    ]) {
      expect(manifest).toContain(`<uses-permission android:name="${permission}" tools:node="remove" />`);
    }
  });
});
