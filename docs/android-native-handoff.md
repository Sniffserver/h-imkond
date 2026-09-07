# HÕIMU: Android Native Handoff & Technical Architecture Specification

**Package Target:** `com.example.hoimu`  
**System Architecture:** Zero-Cloud, Privacy-First, Bioregional Mutual Aid Mesh Network  
**Aesthetic Theme:** Solarpunk Field Terminal (Material 3 + Organic Earth Palette)  
**Min SDK:** API 29+ (Android 10+) | **Target SDK:** API 34+ (Android 14)

---

## 1. Executive Summary & Design System

HÕIMU is designed as an offline-first mutual aid terminal operating entirely over decentralized peer-to-peer radio meshes (Bluetooth Low Energy 5.0+ and Wi-Fi Direct P2P). It requires no central cloud servers, internet connectivity, or blockchain layers.

### 1.1 Color Palette & Solarpunk Theme Tokens

```kotlin
// ui/theme/Color.kt
package com.example.hoimu.ui.theme

import androidx.compose.ui.graphics.Color

val ForestDeep = Color(0xFF203A2A)
val SageGreen = Color(0xFF87A878)
val MossGreen = Color(0xFF588157)
val SolarGold = Color(0xFFE9C46A)
val WarmAmber = Color(0xFFF4A261)
val Terracotta = Color(0xFFE76F51)
val BioregionalTeal = Color(0xFF2A9D8F)
val LightEarth = Color(0xFFFAF6EE)
val SurfaceLight = Color(0xFFF0F5EE)
val InkDark = Color(0xFF243128)
val MutedText = Color(0xFF637062)
```

---

## 2. Room Database Architecture & Data Entities

Local data persistence is managed through Android Jetpack Room with SQLite encryption via SQLCipher.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HoimuDatabase                                 │
├─────────────────┬─────────────────┬─────────────────────────────────────┤
│  PeersDao       │  ResourcesDao   │  TransactionsDao / EndorsementsDao  │
├─────────────────┼─────────────────┼─────────────────────────────────────┤
│  JournalDao     │  MessagesDao    │  UserProfileDao / DaoProposalsDao   │
└─────────────────┴─────────────────┴─────────────────────────────────────┘
```

### 2.1 Entity Schema Definitions

```kotlin
// data/local/entity/Entities.kt
package com.example.hoimu.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverters

@Entity(tableName = "user_profile")
data class UserProfileEntity(
    @PrimaryKey val id: String,
    val callsign: String,
    val bio: String,
    val avatarSeed: String,
    val bioregion: String,
    val symbiosisScore: Int,
    val isMeshVisible: Boolean,
    val skills: List<String>,
    val offeredResources: List<String>,
    val deviceNodeId: String
)

@Entity(tableName = "dao_proposals")
data class DaoProposalEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String,
    val category: String, // "Infrastructure", "Ecological", "Emergency", "Social", "Resource Pool"
    val authorCallsign: String,
    val votesYes: Int,
    val votesNo: Int,
    val votesAbstain: Int,
    val status: String, // "active", "passed", "rejected"
    val createdAt: Long,
    val endsAt: Long,
    val symbiosisReward: Int,
    val requiredQuorum: Int,
    val crdtHash: String?
)

@Entity(tableName = "dao_votes")
data class DaoVoteEntity(
    @PrimaryKey val id: String,
    val proposalId: String,
    val voterCallsign: String,
    val voterPublicKey: String,
    val voteOption: String, // "yes", "no", "abstain"
    val weight: Int,
    val signature: String, // Ed25519 signature hex
    val timestamp: Long
)

@Entity(tableName = "dao_treasury")
data class DaoTreasuryItemEntity(
    @PrimaryKey val id: String,
    val title: String,
    val category: String, // "Equipment", "Seed Reserve", "Solar Hardware", "Tooling"
    val quantity: Int,
    val unit: String,
    val custodianCallsign: String,
    val locationName: String,
    val updatedAt: Long
)

@Entity(tableName = "trust_endorsements")
data class TrustEndorsementEntity(
    @PrimaryKey val id: String,
    val transactionId: String,
    val endorserCallsign: String,
    val recipientCallsign: String,
    val signatureHash: String,
    val comment: String,
    val timestamp: Long,
    val reputationBonus: Int
)
```

---

## 3. WebCrypto to Android KeyStore Mapping

In the Web React implementation, `window.crypto.subtle` is used for Ed25519 key generation and signing. On Android, this maps directly to `KeyGenParameterSpec` and Android KeyStore:

```kotlin
// security/KeyManager.kt
package com.example.hoimu.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature

class AndroidKeyManager {
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    fun generateOrGetKeyPair(alias: String = "hoimu_identity_key") {
        if (!keyStore.containsAlias(alias)) {
            val keyPairGenerator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,
                "AndroidKeyStore"
            )
            val spec = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build()

            keyPairGenerator.initialize(spec)
            keyPairGenerator.generateKeyPair()
        }
    }

    fun signMessage(alias: String, message: ByteArray): ByteArray {
        val entry = keyStore.getEntry(alias, null) as KeyStore.PrivateKeyEntry
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(entry.privateKey)
        signature.update(message)
        return signature.sign()
      }
}
```

---

## 4. QR Code Peer-to-Peer Scanner Integration

Android native camera scanning utilizes Google ML Kit Barcode Scanning API:

```kotlin
// camera/QrCodeScanner.kt
package com.example.hoimu.camera

import androidx.camera.core.ImageAnalysis
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage

class QrCodeAnalyzer(private val onQrCodeScanned: (String) -> Unit) : ImageAnalysis.Analyzer {
    private val scanner = BarcodeScanning.getClient()

    @androidx.camera.core.ExperimentalGetImage
    override fun analyze(imageProxy: androidx.camera.core.ImageProxy) {
        val mediaImage = imageProxy.image ?: return
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                barcodes.firstOrNull()?.rawValue?.let { qrValue ->
                    onQrCodeScanned(qrValue)
                }
            }
            .addOnCompleteListener { imageProxy.close() }
    }
}
```

---

## 5. Self-Hosted Sync Server Protocol

For optional local home servers or Raspberry Pi sync nodes:
- HTTP REST API for CRDT json ledger sync: `POST /api/sync`
- WebSocket server: `ws://<server_ip>:3000/ws` for real-time mesh frame broadcasts
- Authentication: Bearer pairing token generated on local field terminal
