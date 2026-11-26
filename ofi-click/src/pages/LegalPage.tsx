import React, { useState } from 'react';
import { HelpCircle, Lock, Mail, Scale, Send } from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { adminService } from '../services/admin.service';

interface LegalPageProps {
  section: 'privacy' | 'terms' | 'contact' | 'support';
}

export const LegalPage: React.FC<LegalPageProps> = ({ section }) => {
  const { currentUser, navigate, notify, requireAuth, refreshDb } = useOfiClick();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    requireAuth('enviar un ticket al centro de soporte', (user) => {
      adminService.createSupportTicket({
        creatorId: user.id,
        creatorName: user.fullName,
        regionId: user.regionId || 'reg-izcalli',
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });
      setSubject('');
      setDescription('');
      refreshDb();
      notify('Ticket registrado. Nuestro equipo de soporte dará seguimiento pronto.', 'success');
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-[#DBD4C6] dark:border-white/10 pb-4">
        {[
          { id: 'privacy' as const, label: 'Aviso de privacidad', icon: Lock },
          { id: 'terms' as const, label: 'Términos y condiciones', icon: Scale },
          { id: 'support' as const, label: 'Centro de ayuda', icon: HelpCircle },
          { id: 'contact' as const, label: 'Contacto', icon: Mail },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate({ page: 'legal', section: tab.id })}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#214438] text-white dark:bg-[#75836A] dark:text-white'
                  : 'border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] text-[#1D252C] dark:text-[#F7F3EA] hover:border-[#214438]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {section === 'privacy' && (
        <article className="rounded-2xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-[#1D252C]/85 dark:text-[#F7F3EA]/85 shadow-xs">
          <h1 className="text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
            Aviso de Privacidad · OFI CLICK Cuautitlán Izcalli
          </h1>
          <p>
            En OFI CLICK protegemos tus datos personales y ubicaciones exactas. Los perfiles públicos
            muestran únicamente zona general o colonia aproximada de cobertura en Cuautitlán Izcalli,
            Estado de México.
          </p>
          <h2 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA] pt-2">
            1. Protección de direcciones y documentos
          </h2>
          <p>
            Tu dirección exacta solo se comparte con el profesional independiente seleccionado cuando
            aceptas una cotización formal y confirmas una contratación. Los documentos de
            verificación profesional son estrictamente privados para revisión administrativa interna y
            nunca se publican en el directorio.
          </p>
          <h2 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA] pt-2">
            2. Uso de servicios cartográficos
          </h2>
          <p>
            Al utilizar mapas interactivos integrados con Google Maps Platform, aplican la Política de
            Privacidad de Google y las Condiciones de Servicio adicionales de Google Maps/Google Earth.
          </p>
        </article>
      )}

      {section === 'terms' && (
        <article className="rounded-2xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-[#1D252C]/85 dark:text-[#F7F3EA]/85 shadow-xs">
          <h1 className="text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
            Términos y Condiciones de Uso
          </h1>
          <p>
            OFI CLICK opera actualmente en su fase inicial de lanzamiento regional en Cuautitlán Izcalli,
            Estado de México, México.
          </p>
          <h2 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA] pt-2">
            1. Acuerdos y pagos directos fuera de OFI CLICK
          </h2>
          <p>
            OFI CLICK facilita la conexión, solicitud, cotización transparente, mensajería, agenda y
            seguimiento de servicios. En esta etapa, OFI CLICK no procesa pagos en línea, no cobra
            comisiones por servicio ni retiene fondos: el método y momento de cobro se acuerdan
            directamente entre cliente y profesional independiente.
          </p>
          <h2 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA] pt-2">
            2. Reseñas verificadas y moderación
          </h2>
          <p>
            Solo los clientes con una contratación completada pueden publicar una reseña por servicio.
            El equipo administrativo puede pausar perfiles, ocultar reseñas abusivas o suspender
            cuentas que infrinjan las normas comunitarias.
          </p>
        </article>
      )}

      {section === 'support' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-4 shadow-xs">
            <h1 className="text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
              Centro de Ayuda y Soporte OFI CLICK
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-[#ECE7DC]/55 dark:bg-[#161C22] border border-[#DBD4C6]/70 dark:border-white/10">
                <h3 className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                  ¿Cómo funciona el pago del servicio?
                </h3>
                <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                  El profesional envía una cotización clara en MXN y, al aceptarla, ambos acuerdan el
                  pago directo al concluir o según las condiciones cotizadas, sin comisiones ocultas.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#ECE7DC]/55 dark:bg-[#161C22] border border-[#DBD4C6]/70 dark:border-white/10">
                <h3 className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                  ¿Cuándo puedo calificar a un profesional?
                </h3>
                <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                  Solo cuando el servicio pasa por todo el flujo y confirmas que la contratación fue
                  completada. Así garantizamos reseñas reales.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmitTicket}
            className="rounded-2xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-4 shadow-xs"
          >
            <h2 className="text-lg font-bold text-[#1D252C] dark:text-[#F7F3EA]">
              Enviar ticket de soporte {currentUser ? `como ${currentUser.fullName}` : ''}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej. Duda sobre verificación o incidencia en cita"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Prioridad</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Cuéntanos qué necesitas resolver..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors"
            >
              <Send className="w-4 h-4" />
              Enviar ticket
            </button>
          </form>
        </div>
      )}

      {section === 'contact' && (
        <div className="rounded-2xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 sm:p-8 space-y-4 text-sm shadow-xs">
          <h1 className="text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
            Contacto Institucional · OFI CLICK
          </h1>
          <p className="text-[#73766F] dark:text-[#A3A89F]">
            Operación regional inicial: Cuautitlán Izcalli, Estado de México, México.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#ECE7DC]/55 dark:bg-[#161C22] border border-[#DBD4C6]/70 dark:border-white/10">
              <p className="text-xs font-semibold uppercase text-[#73766F]">Soporte a usuarios</p>
              <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA] mt-1">
                soporte.izcalli@oficlick.mx
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#ECE7DC]/55 dark:bg-[#161C22] border border-[#DBD4C6]/70 dark:border-white/10">
              <p className="text-xs font-semibold uppercase text-[#73766F]">Alianzas institucionales</p>
              <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA] mt-1">
                alianzas@oficlick.mx
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
