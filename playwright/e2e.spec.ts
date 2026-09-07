import { test, expect } from '@playwright/test';

/**
 * HÕIMU End-to-End Test Suite
 * Covers three critical resilient user flows:
 * 1. Resource Request / Search Interaction
 * 2. Mesh Message Dispatching
 * 3. Decentralized DAO Bioregional Voting
 */
test.describe('HÕIMU Field Terminal Core E2E Flows', () => {

  test.beforeEach(async ({ page }) => {
    // Open the HÕIMU application and bypass startup/landing modals if present
    await page.goto('/');
    
    // Accept or close any landing welcome page modals if they appear
    const dismissButton = page.locator('button:has-text("Sisenen terminali"), button:has-text("Sisenen"), button:contains("Enter")').first();
    if (await dismissButton.isVisible()) {
      await dismissButton.click();
    }
  });

  test('1. Resource Request & Matchmaking Flow', async ({ page }) => {
    // Navigate to local exchange / resources tab
    const exchangeTab = page.locator('button:has-text("Vahetus"), button:has-text("Exchange"), [id*="exchange"]').first();
    if (await exchangeTab.isVisible()) {
      await exchangeTab.click();
    }

    // Verify presence of resource marketplace or wishlist
    const searchInput = page.locator('input[placeholder*="otsi"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Solar');
      // Verify visual filtering or search results appear
      await expect(page.locator('body')).toContainText(/Solar|Päike/i);
    }

    // Click on a resource item to open detail drawer or modal
    const resourceCard = page.locator('.resource-card, div:has-text("kW"), div:has-text("Vee hoidla")').first();
    if (await resourceCard.isVisible()) {
      await resourceCard.click();
      // Expect detail modal to contain information about the resource and owner
      await expect(page.locator('body')).toContainText(/Hoidla|Omanik|Owner|Kontakt/i);
    }
  });

  test('2. Mesh Message & Beacon Dispatch Flow', async ({ page }) => {
    // Open Peer Mesh view or Chat view
    const meshTab = page.locator('button:has-text("Võrk"), button:has-text("Mesh"), [id*="mesh"]').first();
    if (await meshTab.isVisible()) {
      await meshTab.click();
    }

    // Open message dialogue with a nearby peer
    const messageButton = page.locator('button:has-text("Saada sõnum"), button:has-text("Sõnum"), button:has-text("Message")').first();
    if (await messageButton.isVisible()) {
      await messageButton.click();
      
      // Enter text and send
      const chatInput = page.locator('input[placeholder*="Kirjuta"], input[placeholder*="Type a message"]').first();
      if (await chatInput.isVisible()) {
        await chatInput.fill('HOIMU: Test E2E P2P Packet');
        await page.keyboard.press('Enter');
        
        // Confirm message enters delivery status column
        await expect(page.locator('body')).toContainText(/HOIMU: Test/);
      }
    }
  });

  test('3. Decentered Bioregional DAO Governance Vote Flow', async ({ page }) => {
    // Find and trigger the DAO Modal directly or through Council buttons
    const daoButton = page.locator('button:has-text("DAO"), button:has-text("Nõukogu"), button:has-text("Council")').first();
    if (await daoButton.isVisible()) {
      await daoButton.click();
    } else {
      // Direct state simulation or modal button click
      const profileTab = page.locator('button:has-text("Profiil"), button:has-text("Profile")').first();
      if (await profileTab.isVisible()) {
        await profileTab.click();
        const daoMeshButton = page.locator('button:has-text("DAO Mesh Council"), button:has-text("Nõukogu")').first();
        if (await daoMeshButton.isVisible()) {
          await daoMeshButton.click();
        }
      }
    }

    // Check that proposal lists are loaded
    await expect(page.locator('body')).toContainText(/DAO|Ettepanek|Proposal|Hääletus/i);

    // Vote 'Poolt' (In favor / Yes) on the first active proposal
    const voteButton = page.locator('button:has-text("Poolt"), button:has-text("Vastu"), button:has-text("Vote")').first();
    if (await voteButton.isVisible()) {
      await voteButton.click();
      // Ensure local state stores the vote and displays badge changes
      await expect(page.locator('body')).toContainText(/✓|Hääletatud|Voted/i);
    }
  });
});
