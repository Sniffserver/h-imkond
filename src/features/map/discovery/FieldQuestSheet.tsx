import React, { useState } from 'react';
import { FieldQuest } from '../../../types';
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
  Home,
} from 'lucide-react';

interface FieldQuestSheetProps {
  onClose: () => void;
  onAddToast?: (title: string, desc?: string, type?: 'success' | 'warning' | 'info') => void;
}

export const FieldQuestSheet: React.FC<FieldQuestSheetProps> = ({ onClose, onAddToast }) => {
  const [quests, setQuests] = useState<FieldQuest[]>(() => fieldQuestService.getQuests());
  const activeQuest = quests.find((q) => !q.completed) || quests[0];

  const handleToggleObjective = (questId: string, objectiveId: string) => {
    fieldQuestService.completeObjective(questId, objectiveId);
    setQuests([...fieldQuestService.getQuests()]);
    if (onAddToast) {
      onAddToast('Field Objective Verified', 'Observation recorded into physical ledger', 'success');
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
              Real-world exploratory objectives connecting streets, tools, reuse & mesh
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition"
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
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
              Survey Objectives
            </div>
            <div className="space-y-2">
              {activeQuest.objectives.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => handleToggleObjective(activeQuest.id, obj.id)}
                  className={`w-full text-left p-3 rounded-xl border flex items-start space-x-3 transition ${
                    obj.completed
                      ? 'bg-stone-950/50 border-emerald-900/60 text-stone-300'
                      : 'bg-stone-900/90 hover:bg-stone-800 border-stone-800 text-stone-100'
                  }`}
                >
                  <div className="mt-0.5">
                    {obj.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-stone-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${obj.completed ? 'line-through text-stone-400' : ''}`}>
                      {obj.title}
                    </div>
                    {obj.details && (
                      <div className="text-xs text-stone-400 mt-0.5">{obj.details}</div>
                    )}
                  </div>
                  <div className="text-xs font-mono text-stone-400 pt-0.5">
                    {obj.currentCount}/{obj.targetCount}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
