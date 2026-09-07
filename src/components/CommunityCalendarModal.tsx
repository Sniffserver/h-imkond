import React, { useState } from 'react';
import { CalendarEvent } from '../types';
import {
  X,
  Calendar as CalendarIcon,
  Plus,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  Tag,
  Wrench,
  GraduationCap,
  Sprout,
  Sparkles,
} from 'lucide-react';

interface CommunityCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onAddEvent: (newEvent: Omit<CalendarEvent, 'id' | 'attendeesCount' | 'isUserAttending'>) => void;
  onToggleRsvp: (eventId: string) => void;
  isNightMode?: boolean;
  userCallsign: string;
}

export const CommunityCalendarModal: React.FC<CommunityCalendarModalProps> = ({
  isOpen,
  onClose,
  events,
  onAddEvent,
  onToggleRsvp,
  isNightMode = false,
  userCallsign,
}) => {
  const [activeFilter, setActiveFilter] = useState<'All' | 'Workshop' | 'Workday' | 'Equipment Sharing' | 'Community Meal' | 'Assembly'>('All');
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CalendarEvent['category']>('Workshop');
  const [date, setDate] = useState('2026-09-06');
  const [time, setTime] = useState('14:00 - 17:00');
  const [location, setLocation] = useState('River Crossing Common Hub');
  const [maxCapacity, setMaxCapacity] = useState(15);

  if (!isOpen) return null;

  const filteredEvents = events.filter((e) => activeFilter === 'All' || e.category === activeFilter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddEvent({
      title: title.trim(),
      description: description.trim() || 'Community organized event.',
      category,
      date,
      time,
      location,
      organizerCallsign: userCallsign,
      maxCapacity,
    });

    setTitle('');
    setDescription('');
    setIsAdding(false);
  };

  const categoryColors: Record<CalendarEvent['category'], string> = {
    Workshop: '#2A9D8F',
    Workday: '#588157',
    'Equipment Sharing': '#F4A261',
    'Community Meal': '#87A878',
    Assembly: '#E9C46A',
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
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#588157]/20 border border-[#87A878]/40 flex items-center justify-center text-[#588157] dark:text-[#87A878]">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl">Kogukonna Kalender / Community Calendar</h2>
              <p className="text-xs text-[#637062] dark:text-[#A8BDA5]">
                Workshops, communal workdays, equipment sharing time slots & assemblies.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="px-3.5 py-2 rounded-xl bg-[#588157] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-[#466845] cursor-pointer"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isAdding ? 'Cancel' : 'Add Event'}</span>
          </button>
        </div>

        {/* Filter Bar */}
        {!isAdding && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4 border-b border-current/10 pb-3 shrink-0 text-xs">
            {['All', 'Workshop', 'Workday', 'Equipment Sharing', 'Community Meal', 'Assembly'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveFilter(cat as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                  activeFilter === cat
                    ? 'bg-[#203A2A] text-white border-[#203A2A]'
                    : isNightMode
                    ? 'bg-[#121A10] text-[#A8BDA5] border-[#2A3B26]'
                    : 'bg-white text-[#637062] border-[#87A878]/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-3">
          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-3.5 p-1">
              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Solar PV Panel Installation & Battery Wiring Workshop"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                        : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  >
                    <option value="Workshop">Workshop (Koolitus)</option>
                    <option value="Workday">Workday (Talgud)</option>
                    <option value="Equipment Sharing">Equipment Sharing (Ühiskasutus)</option>
                    <option value="Community Meal">Community Meal (Kogukonna söömaaeg)</option>
                    <option value="Assembly">Assembly (Kogukonna kogu)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Max Capacity:</label>
                  <input
                    type="number"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 10)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                        : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Date:</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                        : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#588157]">Time Window:</label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="e.g. 14:00 - 17:00"
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                      isNightMode
                        ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                        : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">Location:</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. River Crossing Common Hub"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[#588157]">Description:</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline workshop goals, required materials to bring, or safety instructions..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-hidden resize-none ${
                    isNightMode
                      ? 'bg-[#121A10] border-[#364E30] text-[#F0F5EE]'
                      : 'bg-white border-[#87A878]/40 text-[#203A2A]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={!title.trim()}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-[#588157] text-white hover:bg-[#466845] transition-all cursor-pointer shadow-md"
              >
                Publish Event to Local Mesh
              </button>
            </form>
          ) : (
            filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${
                  isNightMode
                    ? 'bg-[#121A10] border-[#2A3B26] text-[#F0F5EE]'
                    : 'bg-white border-[#87A878]/30 text-[#203A2A]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md font-bold text-white"
                        style={{ backgroundColor: categoryColors[evt.category] || '#588157' }}
                      >
                        {evt.category}
                      </span>
                      <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                        Host: {evt.organizerCallsign}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-base">{evt.title}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleRsvp(evt.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                      evt.isUserAttending
                        ? 'bg-[#2A9D8F] text-white shadow-xs'
                        : isNightMode
                        ? 'bg-[#2A3B26] text-[#A8BDA5] hover:text-white'
                        : 'bg-[#E6EDE1] text-[#203A2A] hover:bg-[#d8e3d2]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{evt.isUserAttending ? 'Attending ✓' : 'RSVP / Osale'}</span>
                  </button>
                </div>

                <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                  {evt.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-current/10 text-xs font-mono text-[#637062] dark:text-[#A8BDA5]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-[#588157]" /> {evt.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#F4A261]" /> {evt.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#E76F51]" /> {evt.location}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-[#2A9D8F]">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {evt.attendeesCount} / {evt.maxCapacity || '∞'} Confirmed
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
