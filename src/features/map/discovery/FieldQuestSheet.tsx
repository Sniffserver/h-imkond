import React, { useState, useEffect } from 'react';
import { FieldQuest, FieldQuestObjective } from '../../../types';
import { fieldQuestService } from './fieldQuestService';
import {
  Compass,
  X,
  CheckCircle2,
  Circle,
  Footprints,
  Timer,
  Route,
  Sparkles,
  MapPin,
  Radio,
  Lock,
  Check,
} from 'lucide-react';

interface FieldQuestSheetProps {
  onClose: () => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const FieldQuestSheet: React.FC<FieldQuestSheetProps> = ({ onClose, onAddToast }) => {
  const [quests, setQuests] = useState<FieldQuest[]>(() => fieldQuestService.getQuests());
  
  useEffect(() => {
    const unsub = fieldQuestService.subscribe(() => {
      setQuests([...fieldQuestService.getQuests()]);
    });
    return unsub;
  }, []);

  const activeQuest = quests.find((q) => !q.completed) || quests[0];

  const handleConfirmSubjective = (questId: string, objectiveId: string) => {
    fieldQuestService.completeObjective(questId, objectiveId);
    if (onAddToast) {
      onAddToast('Field Observation Confirmed', 'Subjective observation recorded with User-confirmed ledger entry.', 'success');
    }
  };

  const getObjectiveIcon = (type: string) => {
    switch (type) {
      case 'street_explore':
        return <Footprints className="w-4 h-4 text-emerald-400" />;
      case 'place_find':
        return <MapPin className="w-4 h-4 text-amber-400" />;
      case 'mesh_observe':
        return <Radio className="w-4 h-4 text-sky-400" />;
      case 'return_campfire':
        return <Sparkles className="w-4 h-4 text-teal-400" />;
      default:
        return <Compass className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-stone-900 border-t border-amber-800/50 rounded-t-2xl shadow-2xl p-4 sm:p-6 max-h-[85vh] flex flex-col max-w-2xl mx-auto text-amber-50">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-100 flex items-center gap-2">
              Field Quests
              <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-amber-300 font-mono">
                {activeQuest?.district || 'Tallinn'}
              </span>
            </h2>
            <p className="text-xs text-stone-400">
              Real-world physical exploration objectives (streets, tools, reuse & mesh)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition cursor-pointer"
          aria-label="Close sheet"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Active Quest Content */}
      {activeQuest && (
        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          <div className="p-4 rounded-xl bg-stone-950/80 border border-amber-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-amber-200">{activeQuest.title}</h3>
              {activeQuest.completed && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  COMPLETED
                </span>
              )}
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">{activeQuest.description}</p>

            <div className="flex items-center space-x-4 pt-1 text-xs text-stone-400 font-mono border-t border-stone-800">
              <div className="flex items-center space-x-1.5">
                <Route className="w-4 h-4 text-amber-400" />
                <span>~{activeQuest.targetDistanceKm} km distance</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Timer className="w-4 h-4 text-sky-400" />
                <span>~{activeQuest.estimatedMinutes} min walk</span>
              </div>
            </div>
          </div>

          {/* Objectives Checklist */}
          <div>
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Survey Objectives</span>
              <span className="text-[10px] text-emerald-500 font-mono lowercase tracking-normal font-normal">
                ● gps-based trace auto-verify active
              </span>
            </div>
            <div className="space-y-2">
              {activeQuest.objectives.map((obj) => {
                const isSubjective = obj.type === 'subjective';
                return (
                  <div
                    key={obj.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition ${
                      obj.completed
                        ? 'bg-stone-950/50 border-emerald-900/40 text-stone-300'
                        : 'bg-stone-900/90 border-stone-800 text-stone-100'
                    }`}
                  >
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {obj.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-stone-600 flex items-center justify-center bg-stone-950 text-[10px] text-stone-500 font-mono">
                            {getObjectiveIcon(obj.type)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs sm:text-sm font-bold ${obj.completed ? 'line-through text-stone-400' : ''}`}>
                            {obj.title}
                          </span>
                          {!isSubjective && !obj.completed && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-stone-950 text-stone-400 flex items-center gap-1 shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              AUTO
                            </span>
                          )}
                          {obj.isUserConfirmed && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-[#E9C46A]/10 text-[#E9C46A] border border-[#E9C46A]/20 shrink-0">
                              User-confirmed
                            </span>
                          )}
                        </div>
                        {obj.details && (
                          <div className="text-xs text-stone-400 mt-1">{obj.details}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-center">
                      <span className="text-xs font-mono font-bold text-stone-400 bg-stone-950 px-2 py-0.5 rounded">
                        {obj.currentCount}/{obj.targetCount}
                      </span>

                      {isSubjective && !obj.completed && (
                        <button
                          type="button"
                          onClick={() => handleConfirmSubjective(activeQuest.id, obj.id)}
                          className="px-3 py-1.5 text-xs font-bold uppercase rounded-lg bg-[#E9C46A] hover:bg-[#dfb44f] text-[#10170F] transition shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
