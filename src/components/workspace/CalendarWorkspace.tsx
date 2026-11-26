import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Trash2 } from 'lucide-react';
import type { AvailabilityStatus, DaySchedule, ProfessionalProfile } from '../../types/oficlick';
import { useOfiClick } from '../../context/OfiClickContext';
import { profilesService } from '../../services/profiles.service';

interface CalendarWorkspaceProps {
  pro: ProfessionalProfile;
}

type CalendarViewMode = 'day' | 'week' | 'month';

export const CalendarWorkspace: React.FC<CalendarWorkspaceProps> = ({ pro }) => {
  const { db, refreshDb, notify } = useOfiClick();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<AvailabilityStatus>(pro.availabilityStatus);
  const [urgentAttention, setUrgentAttention] = useState<boolean>(pro.urgentAttention);
  const [schedule, setSchedule] = useState<DaySchedule[]>(() =>
    pro.weeklySchedule.map((d) => ({ ...d }))
  );

  // Add block form
  const [blockDate, setBlockDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('14:00');
  const [blockReason, setBlockReason] = useState('');

  const proBookings = useMemo(
    () =>
      db.bookings.filter(
        (b) =>
          b.professionalId === pro.id &&
          b.status !== 'cancelled' &&
          b.status !== 'rejected'
      ),
    [db.bookings, pro.id]
  );

  const pendingRequests = useMemo(
    () =>
      db.requests.filter(
        (r) =>
          r.recipientProfessionalIds.includes(pro.id) &&
          r.status !== 'accepted' &&
          r.status !== 'cancelled' &&
          r.status !== 'closed'
      ),
    [db.requests, pro.id]
  );

  const personalBlocks = useMemo(
    () => db.availabilityBlocks.filter((b) => b.professionalId === pro.id),
    [db.availabilityBlocks, pro.id]
  );

  const handleSaveSchedule = () => {
    profilesService.updateSchedule(pro.id, schedule, status);
    profilesService.updateProfessionalProfile(pro.id, { urgentAttention });
    refreshDb();
    notify('Horario semanal y estado de disponibilidad actualizados.', 'success');
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockReason.trim()) return;
    profilesService.addAvailabilityBlock({
      professionalId: pro.id,
      date: blockDate,
      startTime: blockStart,
      endTime: blockEnd,
      reason: blockReason.trim(),
      type: 'block',
    });
    setBlockReason('');
    refreshDb();
    notify('Bloqueo manual agregado al calendario.', 'success');
  };

  const handleRemoveBlock = (blockId: string) => {
    profilesService.removeAvailabilityBlock(blockId);
    refreshDb();
    notify('Bloqueo eliminado.', 'info');
  };

  // Generate 7 dates around selectedDate for Week view, and 28 days for Month view
  const weekDays = useMemo(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    const result: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      result.push(d.toISOString().slice(0, 10));
    }
    return result;
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const [year, month] = selectedDate.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    const list: string[] = [];
    for (let day = 1; day <= totalDays; day += 1) {
      list.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
    return list;
  }, [selectedDate]);

  const getEventsForDate = (dateStr: string) => {
    const confirmed = proBookings.filter((b) => b.scheduledDate === dateStr);
    const pending = pendingRequests.filter((r) => r.desiredDate === dateStr);
    const blocks = personalBlocks.filter((bl) => bl.date === dateStr);
    return { confirmed, pending, blocks };
  };

  return (
    <div className="space-y-6">
      {/* Availability status + quick controls */}
      <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
              Disponibilidad y atención urgente
            </h3>
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5">
              Las fechas solo se bloquean automáticamente cuando cliente y profesional aceptan una cita.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AvailabilityStatus)}
              className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/50 dark:bg-[#161C22] text-sm font-medium text-[#1D252C] dark:text-[#F7F3EA]"
            >
              <option value="available">Disponible</option>
              <option value="busy">Agenda ocupada</option>
              <option value="unavailable">No disponible temporalmente</option>
            </select>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#1D252C] dark:text-[#F7F3EA] cursor-pointer">
              <input
                type="checkbox"
                checked={urgentAttention}
                onChange={(e) => setUrgentAttention(e.target.checked)}
                className="rounded border-[#DBD4C6]"
              />
              Atiende urgencias hoy
            </label>
            <button
              type="button"
              onClick={handleSaveSchedule}
              className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#A8431B] text-sm font-semibold whitespace-nowrap transition-colors"
            >
              Guardar disponibilidad
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Views: Day / Week / Month */}
      <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#C7582B]" />
            <h3 className="text-base font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
              Agenda operativa
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
            />
            <div className="inline-flex rounded-lg border border-[#DBD4C6] dark:border-white/15 overflow-hidden">
              {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                    viewMode === mode
                      ? 'bg-[#214438] text-white dark:bg-[#C7582B] dark:text-white'
                      : 'text-[#73766F] hover:bg-[#ECE7DC]/50 dark:hover:bg-white/5'
                  }`}
                >
                  {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#73766F] dark:text-[#A3A89F]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#214438] dark:bg-[#C7582B]" />
            Contratación confirmada (fecha bloqueada)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
            Solicitud pendiente (no bloquea agenda)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#75836A]" />
            Bloqueo manual
          </span>
        </div>

        {viewMode === 'day' && (
          <div className="space-y-2 border-t border-[#DBD4C6] dark:border-white/10 pt-4">
            <p className="text-sm font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
              Eventos del {selectedDate}
            </p>
            {(() => {
              const { confirmed, pending, blocks } = getEventsForDate(selectedDate);
              if (confirmed.length === 0 && pending.length === 0 && blocks.length === 0) {
                return (
                  <p className="text-sm text-[#73766F] dark:text-[#A3A89F] py-6 text-center bg-[#ECE7DC]/40 dark:bg-[#161C22] rounded-lg">
                    Sin compromisos ni bloqueos registrados para este día.
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  {confirmed.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-lg bg-[#214438] text-white dark:bg-[#C7582B] dark:text-white flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong>{b.scheduledTime}</strong> · {b.serviceTitle} ({b.colonia})
                      </div>
                      <span className="font-semibold">Confirmado</span>
                    </div>
                  ))}
                  {pending.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong>{r.desiredTimeSlot}</strong> · {r.title} ({r.colonia})
                      </div>
                      <span>Solicitud sin confirmar</span>
                    </div>
                  ))}
                  {blocks.map((bl) => (
                    <div
                      key={bl.id}
                      className="p-3 rounded-lg bg-[#75836A]/15 dark:bg-[#75836A]/30 text-[#1D252C] dark:text-[#F7F3EA] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong>
                          {bl.startTime} - {bl.endTime}
                        </strong>{' '}
                        · {bl.reason}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlock(bl.id)}
                        className="text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {viewMode === 'week' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 pt-2">
            {weekDays.map((dateStr) => {
              const { confirmed, pending, blocks } = getEventsForDate(dateStr);
              const isSelected = dateStr === selectedDate;
              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`cursor-pointer rounded-lg border p-2.5 min-h-[120px] transition-colors ${
                    isSelected
                      ? 'border-[#C7582B] bg-[#ECE7DC]/60 dark:bg-[#161C22]'
                      : 'border-[#DBD4C6] dark:border-white/10 hover:border-[#214438]/40'
                  }`}
                >
                  <div className="text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA] mb-2">
                    {dateStr.slice(5)}
                  </div>
                  <div className="space-y-1">
                    {confirmed.map((b) => (
                      <div
                        key={b.id}
                        className="px-2 py-1 rounded bg-[#214438] text-white dark:bg-[#C7582B] dark:text-white text-[11px] truncate"
                        title={b.serviceTitle}
                      >
                        {b.scheduledTime} {b.serviceTitle}
                      </div>
                    ))}
                    {pending.map((r) => (
                      <div
                        key={r.id}
                        className="px-2 py-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 text-[11px] truncate"
                        title={r.title}
                      >
                        Pend: {r.title}
                      </div>
                    ))}
                    {blocks.map((bl) => (
                      <div
                        key={bl.id}
                        className="px-2 py-1 rounded bg-[#75836A]/20 text-[#214438] dark:text-[#ECE7DC] text-[11px] truncate"
                        title={bl.reason}
                      >
                        {bl.startTime} {bl.reason}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'month' && (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-2">
            {monthDays.map((dateStr) => {
              const { confirmed, pending, blocks } = getEventsForDate(dateStr);
              const total = confirmed.length + pending.length + blocks.length;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setViewMode('day');
                  }}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    dateStr === selectedDate
                      ? 'border-[#C7582B] bg-[#ECE7DC] dark:bg-[#161C22]'
                      : 'border-[#DBD4C6] dark:border-white/10 hover:bg-[#ECE7DC]/40'
                  }`}
                >
                  <div className="text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                    {dateStr.slice(8)}
                  </div>
                  <div className="mt-1 flex items-center gap-1 min-h-[14px]">
                    {confirmed.length > 0 && (
                      <span className="w-2 h-2 rounded-xs bg-[#214438] dark:bg-[#C7582B]" />
                    )}
                    {pending.length > 0 && (
                      <span className="w-2 h-2 rounded-xs bg-amber-500" />
                    )}
                    {blocks.length > 0 && (
                      <span className="w-2 h-2 rounded-xs bg-[#75836A]" />
                    )}
                    {total > 0 && (
                      <span className="text-[10px] text-[#73766F] ml-auto">{total}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Manual Block & Weekly Working Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleAddBlock}
          className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-4"
        >
          <h4 className="text-sm font-semibold text-[#1D252C] dark:text-[#F7F3EA] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#C7582B]" />
            Bloquear horario manualmente
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#73766F] mb-1">Fecha</label>
              <input
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#73766F] mb-1">Inicio</label>
              <input
                type="time"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#73766F] mb-1">Fin</label>
              <input
                type="time"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#73766F] mb-1">Motivo</label>
            <input
              type="text"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Ej. Compra de material o cita personal"
              className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              required
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Agregar bloqueo
          </button>

          {personalBlocks.length > 0 && (
            <div className="pt-2 border-t border-[#DBD4C6] dark:border-white/10 space-y-1.5">
              <p className="text-xs font-medium text-[#73766F]">Bloqueos activos:</p>
              {personalBlocks.map((bl) => (
                <div
                  key={bl.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#ECE7DC]/50 dark:bg-[#161C22]"
                >
                  <span>
                    {bl.date} ({bl.startTime}-{bl.endTime}) · {bl.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlock(bl.id)}
                    className="text-red-600 dark:text-red-400 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Weekly Schedule Table */}
        <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#1D252C] dark:text-[#F7F3EA] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C7582B]" />
              Horario laboral semanal
            </h4>
            <button
              type="button"
              onClick={handleSaveSchedule}
              className="text-xs font-semibold text-[#214438] dark:text-[#C7582B] hover:underline"
            >
              Guardar horarios
            </button>
          </div>
          <div className="space-y-2">
            {schedule.map((day, idx) => (
              <div
                key={day.day}
                className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5 border-b border-[#DBD4C6]/70 dark:border-white/8 last:border-none"
              >
                <label className="inline-flex items-center gap-2 min-w-[100px] font-medium text-[#1D252C] dark:text-[#F7F3EA]">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[idx] = { ...next[idx], enabled: e.target.checked };
                      setSchedule(next);
                    }}
                  />
                  {day.label}
                </label>
                {day.enabled ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={day.start}
                      onChange={(e) => {
                        const next = [...schedule];
                        next[idx] = { ...next[idx], start: e.target.value };
                        setSchedule(next);
                      }}
                      className="px-2 py-1 rounded border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                    />
                    <span>a</span>
                    <input
                      type="time"
                      value={day.end}
                      onChange={(e) => {
                        const next = [...schedule];
                        next[idx] = { ...next[idx], end: e.target.value };
                        setSchedule(next);
                      }}
                      className="px-2 py-1 rounded border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                    />
                  </div>
                ) : (
                  <span className="text-[#73766F]">Descanso</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
