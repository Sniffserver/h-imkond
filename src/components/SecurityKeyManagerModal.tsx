import React, { useState } from 'react';
import { CryptoIdentity } from '../types';
import {
  encryptDataWithPassphrase,
  decryptDataWithPassphrase,
  verifyWebAuthnBiometric,
} from '../utils/cryptoHelper';
import {
  X,
  Key,
  ShieldCheck,
  Download,
  Upload,
  Lock,
  Unlock,
  Fingerprint,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SecurityKeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cryptoIdentity: CryptoIdentity;
  onImportIdentity: (importedIdentity: CryptoIdentity) => void;
  isNightMode?: boolean;
}

export const SecurityKeyManagerModal: React.FC<SecurityKeyManagerModalProps> = ({
  isOpen,
  onClose,
  cryptoIdentity,
  onImportIdentity,
  isNightMode = false,
}) => {
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importBundleText, setImportBundleText] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [exportedBundle, setExportedBundle] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [webAuthnStatus, setWebAuthnStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyPublicKey = () => {
    navigator.clipboard.writeText(cryptoIdentity.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleExportIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportPassphrase.trim()) return;

    setIsEncrypting(true);
    try {
      const bundleStr = JSON.stringify({
        publicKey: cryptoIdentity.publicKey,
        algorithm: cryptoIdentity.algorithm,
        createdAt: cryptoIdentity.createdAt,
      });

      const encrypted = await encryptDataWithPassphrase(bundleStr, exportPassphrase);
      setExportedBundle(encrypted);
      setStatusMessage('✓ Encrypted Key Bundle created! Save or copy securely.');
    } catch (err) {
      setStatusMessage('⚠️ Export encryption failed.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleImportIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importBundleText.trim() || !importPassphrase.trim()) return;

    try {
      const decryptedStr = await decryptDataWithPassphrase(
        importBundleText.trim(),
        importPassphrase
      );
      const parsed = JSON.parse(decryptedStr);
      if (parsed && parsed.publicKey) {
        onImportIdentity({
          publicKey: parsed.publicKey,
          algorithm: parsed.algorithm || 'Ed25519',
          createdAt: parsed.createdAt || Date.now(),
        });
        setStatusMessage('✓ Identity imported successfully!');
        setImportBundleText('');
        setImportPassphrase('');
      } else {
        setStatusMessage('⚠️ Invalid identity bundle layout.');
      }
    } catch {
      setStatusMessage('⚠️ Decryption failed! Check password or bundle payload.');
    }
  };

  const handleTestWebAuthn = async () => {
    setWebAuthnStatus('Prompting Biometric Authenticator...');
    const passed = await verifyWebAuthnBiometric('Test HÕIMU Biometric Hardware');
    if (passed) {
      setWebAuthnStatus('✓ Biometric authentication verified!');
    } else {
      setWebAuthnStatus('⚠️ Biometric check cancelled or unavailable.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden p-6 transition-colors duration-200 max-h-[90vh] flex flex-col ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F]">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl">Cryptographic Key Manager</h3>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Ed25519 WebCrypto pseudonymous identity & encrypted exports.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1">
          {/* Active Public Key Card */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#588157]">Active Pseudonymous Public Key:</span>
              <button
                type="button"
                onClick={handleCopyPublicKey}
                className="text-xs font-bold text-[#2A9D8F] flex items-center gap-1 cursor-pointer hover:underline"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
              </button>
            </div>
            <p className="font-mono text-xs break-all text-[#203A2A] dark:text-[#F0F5EE] bg-[#FAF6EE] dark:bg-[#182315] p-2.5 rounded-xl border border-current/10">
              {cryptoIdentity.publicKey}
            </p>
            <div className="flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
              <span>Algorithm: {cryptoIdentity.algorithm}</span>
              <span>Generated: {new Date(cryptoIdentity.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* WebAuthn Hardware Biometric Verification Test */}
          <div className="p-3.5 rounded-2xl bg-[#588157]/15 border border-[#87A878]/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#588157]" />
                <span className="font-bold text-xs">WebAuthn Hardware Biometrics</span>
              </div>
              <button
                type="button"
                onClick={handleTestWebAuthn}
                className="px-3 py-1 rounded-xl bg-[#588157] text-white text-xs font-bold hover:bg-[#466845] cursor-pointer"
              >
                Verify Biometrics
              </button>
            </div>
            {webAuthnStatus && (
              <p className="text-xs font-mono font-bold text-[#2A9D8F]">{webAuthnStatus}</p>
            )}
          </div>

          {/* Export Identity Form */}
          <form onSubmit={handleExportIdentity} className="p-3.5 rounded-2xl border border-current/10 space-y-2.5">
            <h4 className="font-bold text-xs text-[#588157] flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              <span>Export Identity Key Bundle (Encrypted)</span>
            </h4>
            <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
              Protect your key bundle with a passphrase before exporting to another field device.
            </p>
            <input
              type="password"
              required
              value={exportPassphrase}
              onChange={(e) => setExportPassphrase(e.target.value)}
              placeholder="Set export encryption password"
              className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                isNightMode ? 'bg-[#121A10] border-[#364E30]' : 'bg-white border-[#87A878]/40'
              }`}
            />
            <button
              type="submit"
              disabled={isEncrypting}
              className="w-full py-2 bg-[#588157] text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-[#466845]"
            >
              Generate Encrypted Bundle
            </button>

            {exportedBundle && (
              <div className="mt-2 p-2.5 rounded-xl bg-[#121A10] text-[#A8BDA5] font-mono text-[10px] break-all border border-[#2A3B26]">
                <p className="font-bold text-[#2A9D8F] mb-1">Encrypted Payload (PBKDF2 + AES-GCM):</p>
                <p className="line-clamp-3">{exportedBundle}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(exportedBundle);
                    setStatusMessage('✓ Bundle copied to clipboard!');
                  }}
                  className="mt-2 text-[#2A9D8F] underline cursor-pointer font-bold"
                >
                  Copy Bundle String
                </button>
              </div>
            )}
          </form>

          {/* Import Identity Form */}
          <form onSubmit={handleImportIdentity} className="p-3.5 rounded-2xl border border-current/10 space-y-2.5">
            <h4 className="font-bold text-xs text-[#2A9D8F] flex items-center gap-1.5">
              <Upload className="w-4 h-4" />
              <span>Import Existing Identity Bundle</span>
            </h4>
            <textarea
              required
              rows={2}
              value={importBundleText}
              onChange={(e) => setImportBundleText(e.target.value)}
              placeholder="Paste encrypted Base64 key bundle here..."
              className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-hidden ${
                isNightMode ? 'bg-[#121A10] border-[#364E30]' : 'bg-white border-[#87A878]/40'
              }`}
            />
            <input
              type="password"
              required
              value={importPassphrase}
              onChange={(e) => setImportPassphrase(e.target.value)}
              placeholder="Enter decryption passphrase"
              className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-hidden ${
                isNightMode ? 'bg-[#121A10] border-[#364E30]' : 'bg-white border-[#87A878]/40'
              }`}
            />
            <button
              type="submit"
              className="w-full py-2 bg-[#2A9D8F] text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-[#207a6f]"
            >
              Decrypt & Import Key
            </button>
          </form>

          {statusMessage && (
            <p className="p-2.5 rounded-xl font-mono text-xs font-bold bg-[#588157]/15 text-[#588157]">
              {statusMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
