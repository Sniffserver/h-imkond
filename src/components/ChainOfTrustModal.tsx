import React, { useState } from 'react';
import { Transaction, TrustEndorsement, UserProfile, MeshNode } from '../types';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Award,
  Lock,
  Sparkles,
  Key,
  FileCheck,
  ArrowRight,
  Send,
  Fingerprint,
} from 'lucide-react';

interface ChainOfTrustModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  endorsements: TrustEndorsement[];
  user: UserProfile;
  peers: MeshNode[];
  onEndorseTransaction: (transactionId: string, comment: string) => void;
  isNightMode?: boolean;
}

export const ChainOfTrustModal: React.FC<ChainOfTrustModalProps> = ({
  isOpen,
  onClose,
  transactions,
  endorsements,
  user,
  peers,
  onEndorseTransaction,
  isNightMode = false,
}) => {
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const completedTxs = transactions.filter((t) => t.status === 'completed');

  const handleEndorseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxId) return;

    onEndorseTransaction(selectedTxId, comment.trim() || 'Verified genuine mutual aid transaction.');
    setComment('');
    setSelectedTxId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden p-6 transition-colors duration-200 max-h-[90vh] flex flex-col ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/50 text-[#203A2A]'
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer ${
            isNightMode ? 'hover:bg-[#2A3B26] text-[#A8BDA5]' : 'hover:bg-[#E6EDE1] text-[#637062]'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F] shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2A9D8F]/20 text-[#2A9D8F] text-[10px] font-mono font-bold mb-0.5">
              <Lock className="w-3 h-3" />
              Ed25519 Peer Cryptographic Signatures
            </div>
            <h2 className="font-display font-bold text-xl">Usaldusväärsuse Ahel / Chain of Trust</h2>
            <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
              Verify & cryptographically endorse peer transactions to boost local mesh reputation without central servers.
            </p>
          </div>
        </div>

        {/* Body scroll */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-5">
          {/* Form to Endorse a Completed Transaction */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/35 shadow-xs'
            }`}
          >
            <h3 className="font-display font-bold text-sm text-[#588157] flex items-center gap-1.5">
              <Fingerprint className="w-4 h-4 text-[#2A9D8F]" />
              Endorse & Sign a Mutual Aid Exchange
            </h3>

            <form onSubmit={handleEndorseSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-[#637062] dark:text-[#A8BDA5]">
                  Select Completed Exchange to Sign:
                </label>
                <select
                  value={selectedTxId}
                  onChange={(e) => setSelectedTxId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode
                      ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
                  }`}
                >
                  <option value="">-- Choose Completed Transaction --</option>
                  {completedTxs.map((tx) => (
                    <option key={tx.id} value={tx.id} disabled={tx.isEndorsed}>
                      {tx.resourceTitle} (Between {tx.providerCallsign} & {tx.requesterCallsign}){' '}
                      {tx.isEndorsed ? '✓ Already Endorsed' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#637062] dark:text-[#A8BDA5]">
                  Verification Note / Testimonial:
                </label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Excellent exchange, gear was clean and fully operational."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode
                      ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={!selectedTxId}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  !selectedTxId
                    ? 'opacity-50 bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-[#203A2A] hover:bg-[#16271c] text-white shadow-xs'
                }`}
              >
                <Key className="w-4 h-4 text-[#E9C46A]" />
                <span>Generate Cryptographic Signature & Grant +15 Symbiosis Pts</span>
              </button>
            </form>
          </div>

          {/* Existing Endorsements Chain */}
          <div className="space-y-3">
            <h3 className="font-display font-bold text-sm text-[#588157] flex items-center justify-between">
              <span>Verified Local Mesh Endorsement Certificates ({endorsements.length})</span>
              <span className="text-[10px] font-mono font-bold text-[#2A9D8F] bg-[#2A9D8F]/15 px-2 py-0.5 rounded-md">
                100% Zero-Cloud Cryptography
              </span>
            </h3>

            {endorsements.map((end) => (
              <div
                key={end.id}
                className={`p-4 rounded-2xl border space-y-2 transition-colors ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE]'
                    : 'bg-white border-[#87A878]/30 text-[#203A2A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[#2A9D8F]" />
                    <span className="font-bold text-xs">{end.endorserCallsign}</span>
                    <span className="text-xs text-[#637062] dark:text-[#A8BDA5]">endorsed</span>
                    <span className="font-bold text-xs">{end.recipientCallsign}</span>
                  </div>

                  <span className="text-[10px] font-mono text-[#588157] font-bold bg-[#87A878]/20 px-2 py-0.5 rounded-full">
                    +{end.reputationBonus} Pts
                  </span>
                </div>

                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] bg-[#FAF6EE] dark:bg-[#182315] p-2.5 rounded-xl border border-current/10">
                  "{end.comment}"
                </p>

                <div className="flex items-center justify-between text-[10px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                  <span className="truncate max-w-[320px]">
                    Signature Hash: <code className="text-[#2A9D8F] font-bold">{end.signatureHash}</code>
                  </span>
                  <span>{new Date(end.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
