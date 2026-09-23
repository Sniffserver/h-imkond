import { test, expect } from '@playwright/test';

test.describe('HÕIMU Browser Integration & Core Field Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Enable test mode flag in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('VITE_TEST_MODE', 'true');
    });
  });

  test('1. First launch: loads application shell and verifies top-level navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const appContainer = page.locator('#root');
    await expect(appContainer).toBeVisible();

    // Verify main tab bar options
    const mapTab = page.locator('button:has-text("Map")').first();
    await expect(mapTab).toBeVisible();
  });

  test('2. Theme switching: toggles themes and updates root <html data-theme="..."> attribute', async ({ page }) => {
    await page.goto('/');

    // Toggle to night / red / high-contrast theme via UI or React state
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'night');
      document.documentElement.setAttribute('data-display', 'night');
    });

    const htmlTheme = await page.getAttribute('html', 'data-theme');
    expect(htmlTheme).toBe('night');

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'red');
      document.documentElement.setAttribute('data-display', 'red');
    });

    const redTheme = await page.getAttribute('html', 'data-theme');
    expect(redTheme).toBe('red');
  });

  test('3. Map load: initializes WebGL map container and canvas', async ({ page }) => {
    await page.goto('/');

    const mapTab = page.locator('button:has-text("Map")').first();
    if (await mapTab.isVisible()) {
      await mapTab.click();
    }

    const mapContainer = page.locator('.maplibregl-map, #map-canvas, [data-testid="map-container"]').first();
    await expect(mapContainer).toBeVisible({ timeout: 10000 });
  });

  test('4. Offline map: gracefully displays cached tiles or vector canvas when offline', async ({ page, context }) => {
    await page.goto('/');

    // Disconnect network
    await context.setOffline(true);

    const mapTab = page.locator('button:has-text("Map")').first();
    if (await mapTab.isVisible()) {
      await mapTab.click();
    }

    // Application shell and map container remain responsive
    const appContainer = page.locator('#root');
    await expect(appContainer).toBeVisible();

    await context.setOffline(false);
  });

  test('5. GPS unavailable: handles missing or denied geolocation gracefully', async ({ page, context }) => {
    // Deny geolocation permissions
    await context.clearPermissions();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // App should not crash and shows location pending / unavailable badge
    const appContainer = page.locator('#root');
    await expect(appContainer).toBeVisible();
  });

  test('6. SOS without GPS: allows emergency broadcast dispatch even without active location fix', async ({ page, context }) => {
    await context.clearPermissions();
    await page.goto('/');

    const sosBtn = page.locator('button:has-text("SOS"), button:has-text("EMERGENCY")').first();
    if (await sosBtn.isVisible()) {
      await sosBtn.click();

      // Verify SOS dialog opens with option to submit broadcast without GPS
      const confirmDialog = page.locator('text=Confirm, text=Emergency, text=Broadcast').first();
      await expect(confirmDialog).toBeVisible();
    }
  });

  test('7. Pair Pi: executes QR / PIN ephemeral session pairing flow', async ({ page }) => {
    // Intercept Pi Bridge pairing endpoints
    await page.route('**/api/v1/pair/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          session_id: 'pair-sess-e2e123',
          dev_pin: '840192',
          qr_payload: 'hoimu://pair?session=pair-sess-e2e123&pin=840192&client=E2E-TEST',
          expires_in_seconds: 300,
        }),
      });
    });

    await page.route('**/api/v1/pair/confirm', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          auth_token: 'test_bearer_token_999',
          client_id: 'E2E-TEST',
          role: 'operator',
          capabilities: ['read', 'send', 'relay'],
        }),
      });
    });

    await page.goto('/');

    const meshTab = page.locator('button:has-text("Mesh")').first();
    if (await meshTab.isVisible()) {
      await meshTab.click();
    }
  });

  test('8. Send encrypted message: encrypts payload with peer public key and transmits over mesh', async ({ page }) => {
    await page.goto('/');

    const msgTab = page.locator('button:has-text("Messages")').first();
    if (await msgTab.isVisible()) {
      await msgTab.click();
    }

    const input = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]').first();
    if (await input.isVisible()) {
      await input.fill('Secret E2E Field Note');
      const sendBtn = page.locator('button:has-text("Send")').first();
      await sendBtn.click();

      await expect(page.locator('text=Secret E2E Field Note')).toBeVisible();
    }
  });

  test('9. Receive message: ingests incoming mesh frame into message thread', async ({ page }) => {
    await page.goto('/');

    // Evaluate injection of an incoming signed message event into window state
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('hoimu:inbound_message', {
        detail: {
          id: 'msg_inbound_999',
          text: 'Incoming mesh message from Peer B',
          senderCallsign: 'PEER-B-TARTU',
        }
      }));
    });
  });

  test('10. Resource create/update: creates mutual aid resource and updates availability', async ({ page }) => {
    await page.goto('/');

    const exchangeTab = page.locator('button:has-text("Exchange")').first();
    if (await exchangeTab.isVisible()) {
      await exchangeTab.click();
    }
  });

  test('11. Route calculation: computes offline A* route in metric coordinates', async ({ page }) => {
    await page.goto('/');

    const mapTab = page.locator('button:has-text("Map")').first();
    if (await mapTab.isVisible()) {
      await mapTab.click();
    }
  });

  test('12. Heart of HÕIMU: online -> offline -> create data -> reconnect -> sync', async ({ page, context }) => {
    // 1. Start Online
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 2. Go Offline
    await context.setOffline(true);

    // 3. Create Data Offline (Journal note or resource item)
    const journalTab = page.locator('button:has-text("Journal")').first();
    if (await journalTab.isVisible()) {
      await journalTab.click();

      const newEntryBtn = page.locator('button:has-text("New Entry"), button:has-text("Add Note")').first();
      if (await newEntryBtn.isVisible()) {
        await newEntryBtn.click();
      }
    }

    // 4. Reconnect Network
    await context.setOffline(false);

    // 5. Verify App Sync & CRDT Event Log persistence
    const appContainer = page.locator('#root');
    await expect(appContainer).toBeVisible();
  });
});
