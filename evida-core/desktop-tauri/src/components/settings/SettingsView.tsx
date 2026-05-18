import { useEffect, useRef, useState } from "react";
import type { DatabaseSecurityStatus, SecuritySettings } from "../../types";
import { createEncryptedBackup, getSetting, restoreEncryptedBackup, setSetting } from "../../lib/api";

type Props = {
  open: boolean;
  dbSecurity: DatabaseSecurityStatus | null;
  onClose: () => void;
  onOpenDataFolder: () => void;
};

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  local_processing_default: true,
  external_ai_enabled: false,
  allow_source_excerpt_sending: false,
  allow_full_document_sending: false,
  require_external_ai_confirmation: true,
  encrypt_case_metadata: true,
  encrypt_source_excerpts: true,
  encrypt_chat_log: true,
  encrypt_export_buffer: true,
  redact_logs: true,
  no_document_text_logs: true,
  no_chat_logs: true,
  no_sensitive_path_logs: true,
  block_export_without_control: true,
  include_sources_in_export: true,
  mark_exports_with_coverage: true,
  allow_export_without_control: false,
  screen_sharing_mode: false,
  hide_sensitive_previews: true,
  hide_document_names_in_screen_share: true,
  hide_party_names_in_window_title: false,
  auto_lock: "15",
  answer_length: "balanced",
  answer_structure: "standard",
  show_work_states: true,
  progressive_answer_reveal: true,
  follow_answer_while_writing: true,
  show_suggested_next_steps: true,
  allow_numbered_followups: true,
  adapt_workstyle_locally: true,
  auto_process_documents: true,
  show_processing_in_case_room: true,
  hide_technical_details_by_default: true,
  preliminary_summary_threshold: 80,
  draft_control_threshold: 95,
  warn_on_large_files: true,
  preserve_originals_locally: true,
  keep_encrypted_copy_only: false,
  provider_mode: "off",
  text_size: "normal",
  high_contrast: false,
  reduce_motion: false,
  disable_typewriter_effect: false,
  disable_auto_scroll_while_answering: false,
  announce_import_status: true,
  announce_answer_completion: true,
  announce_summary_ready: true,
  automatic_local_backup: false,
  encrypted_backup: true,
  backup_frequency: "off",
};

const SECURITY_KEY = "security";
const TABS = [
  "Generelt",
  "Saksrom",
  "Dokumenter",
  "Sikkerhet",
  "Lagring",
  "AI-provider",
  "Tilgjengelighet",
  "Tastatursnarveier",
  "Om Evida",
];

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="settings-status-row">
      <span>{label}</span>
      <strong className={ok ? "is-ok" : "is-warn"}>{value}</strong>
    </div>
  );
}

function SettingCheck({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function SettingsView({ open, dbSecurity, onClose, onOpenDataFolder }: Props) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState("Sikkerhet");
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [status, setStatus] = useState("");
  const [restorePath, setRestorePath] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    window.setTimeout(() => dialogRef.current?.focus(), 0);
    getSetting(SECURITY_KEY)
      .then((value) => {
        if (value) {
          setSecurity({ ...DEFAULT_SECURITY_SETTINGS, ...JSON.parse(value) });
        }
      })
      .catch(() => setSecurity(DEFAULT_SECURITY_SETTINGS));
  }, [open]);

  async function updateSecurity(patch: Partial<SecuritySettings>) {
    const next = { ...security, ...patch };
    setSecurity(next);
    await setSetting(SECURITY_KEY, JSON.stringify(next));
    for (const [key, value] of Object.entries(next)) {
      await setSetting(`security.${key}`, JSON.stringify(value));
    }
    setStatus("Innstillingene er lagret.");
  }

  async function handleCreateEncryptedBackup() {
    const report = await createEncryptedBackup();
    setStatus(report.path ? `${report.message} ${report.path}` : report.message);
  }

  async function handleRestoreEncryptedBackup() {
    if (!restorePath.trim()) {
      setStatus("Lim inn filbanen til en .evida-backup.json-fil først.");
      return;
    }
    const report = await restoreEncryptedBackup(restorePath.trim());
    setStatus(report.path ? `${report.message} ${report.path}` : report.message);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Innstillinger"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-modal__header">
          <div>
            <p className="eyebrow">Evida</p>
            <h2>Innstillinger</h2>
          </div>
          <button type="button" className="button-secondary" onClick={onClose}>Lukk</button>
        </div>
        <div className="settings-shell">
          <nav className="settings-tabs" aria-label="Innstillingsfaner">
            {TABS.map((tab) => (
              <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </nav>
          <div className="settings-panel">
            {activeTab === "Generelt" ? (
              <div className="settings-section">
                <h3>Generelt</h3>
                <SettingCheck checked={security.local_processing_default} label="Behandle saker lokalt som standard" onChange={(checked) => void updateSecurity({ local_processing_default: checked })} />
                <SettingCheck checked={security.screen_sharing_mode} label="Aktiver skjermdelingsmodus" onChange={(checked) => void updateSecurity({ screen_sharing_mode: checked })} />
                <label className="settings-field">
                  Automatisk lås
                  <select value={security.auto_lock} onChange={(event) => void updateSecurity({ auto_lock: event.target.value as SecuritySettings["auto_lock"] })}>
                    <option value="never">Aldri</option>
                    <option value="5">5 minutter</option>
                    <option value="15">15 minutter</option>
                    <option value="30">30 minutter</option>
                    <option value="system_lock">Når datamaskinen låses</option>
                  </select>
                </label>
              </div>
            ) : activeTab === "Sikkerhet" ? (
              <div className="settings-section">
                <h3>Sikkerhetsstatus</h3>
                <div className="settings-status-grid">
                  <StatusRow label="Lokal behandling" value="Aktiv" ok />
                  <StatusRow label="Ekstern AI" value={security.external_ai_enabled ? "Aktiv" : "Av"} ok={!security.external_ai_enabled} />
                  <StatusRow label="Kryptert lagring" value={dbSecurity?.encrypted_at_rest ? "Aktiv" : "Ikke verifisert"} ok={dbSecurity?.encrypted_at_rest} />
                  <StatusRow label="Full databasekryptering" value="Krever kontroll" />
                  <StatusRow label="Produksjonsbruk" value="Ikke godkjent for ekte klientdata ennå" />
                </div>
                <div className="settings-note">
                  <strong>Database:</strong> {dbSecurity?.database_path || "Ukjent"}
                  <br />
                  <strong>Nøkkelkilde:</strong> {dbSecurity?.key_source || "Ukjent"}
                  {dbSecurity?.warnings?.length ? <p>{dbSecurity.warnings.join(" ")}</p> : null}
                </div>
                <h3>Lokal behandling</h3>
                <SettingCheck checked={security.local_processing_default} label="Behandle dokumenter lokalt som standard" onChange={(checked) => void updateSecurity({ local_processing_default: checked })} />
                <SettingCheck checked={security.require_external_ai_confirmation} label="Ikke send dokumentinnhold eksternt uten eksplisitt godkjenning" onChange={(checked) => void updateSecurity({ require_external_ai_confirmation: checked })} />
                <h3>Kryptering</h3>
                <SettingCheck checked={security.encrypt_case_metadata} label="Krypter saksmetadata" onChange={(checked) => void updateSecurity({ encrypt_case_metadata: checked })} />
                <SettingCheck checked={security.encrypt_source_excerpts} label="Krypter kildeutdrag" onChange={(checked) => void updateSecurity({ encrypt_source_excerpts: checked })} />
                <SettingCheck checked={security.encrypt_chat_log} label="Krypter chatlogg" onChange={(checked) => void updateSecurity({ encrypt_chat_log: checked })} />
                <SettingCheck checked={security.encrypt_export_buffer} label="Krypter eksportbuffer" onChange={(checked) => void updateSecurity({ encrypt_export_buffer: checked })} />
                <h3>Logging</h3>
                <SettingCheck checked={security.no_document_text_logs} label="Ikke logg dokumenttekst" onChange={(checked) => void updateSecurity({ no_document_text_logs: checked })} />
                <SettingCheck checked={security.no_chat_logs} label="Ikke logg chatinnhold" onChange={(checked) => void updateSecurity({ no_chat_logs: checked })} />
                <SettingCheck checked={security.no_sensitive_path_logs} label="Ikke logg sensitive filbaner" onChange={(checked) => void updateSecurity({ no_sensitive_path_logs: checked })} />
                <SettingCheck checked={security.redact_logs} label="Rediger sensitive felt i feillogger" onChange={(checked) => void updateSecurity({ redact_logs: checked })} />
                <h3>Eksport</h3>
                <SettingCheck checked={security.block_export_without_control} label="Krev kontroll før eksport" onChange={(checked) => void updateSecurity({ block_export_without_control: checked })} />
                <SettingCheck checked={security.include_sources_in_export} label="Inkluder kildeoversikt" onChange={(checked) => void updateSecurity({ include_sources_in_export: checked })} />
                <SettingCheck checked={security.mark_exports_with_coverage} label="Merk eksport med dekningsgrad" onChange={(checked) => void updateSecurity({ mark_exports_with_coverage: checked })} />
                <SettingCheck checked={security.allow_export_without_control} label="Tillat eksport uten kontroll" onChange={(checked) => void updateSecurity({ allow_export_without_control: checked })} />
              </div>
            ) : activeTab === "Saksrom" ? (
              <div className="settings-section">
                <h3>Saksrom</h3>
                <label className="settings-field">
                  Svarlengde
                  <select value={security.answer_length} onChange={(event) => void updateSecurity({ answer_length: event.target.value as SecuritySettings["answer_length"] })}>
                    <option value="short">Kort</option>
                    <option value="balanced">Balansert</option>
                    <option value="detailed">Detaljert</option>
                  </select>
                </label>
                <label className="settings-field">
                  Svarstruktur
                  <select value={security.answer_structure} onChange={(event) => void updateSecurity({ answer_structure: event.target.value as SecuritySettings["answer_structure"] })}>
                    <option value="standard">Standard</option>
                    <option value="sources_first">Kilder først</option>
                    <option value="assessment_first">Vurdering først</option>
                  </select>
                </label>
                <SettingCheck checked={security.show_work_states} label="Vis arbeidssteg før svar" onChange={(checked) => void updateSecurity({ show_work_states: checked })} />
                <SettingCheck checked={security.progressive_answer_reveal} label="Skriv svar progressivt" onChange={(checked) => void updateSecurity({ progressive_answer_reveal: checked })} />
                <SettingCheck checked={security.follow_answer_while_writing} label="Følg svaret mens det skrives" onChange={(checked) => void updateSecurity({ follow_answer_while_writing: checked })} />
                <SettingCheck checked={security.show_suggested_next_steps} label="Vis foreslåtte neste steg" onChange={(checked) => void updateSecurity({ show_suggested_next_steps: checked })} />
                <SettingCheck checked={security.allow_numbered_followups} label="Tillat 1-4 som oppfølging" onChange={(checked) => void updateSecurity({ allow_numbered_followups: checked })} />
                <SettingCheck checked={security.adapt_workstyle_locally} label="Tilpass Saksrom lokalt til arbeidsmåten min" onChange={(checked) => void updateSecurity({ adapt_workstyle_locally: checked })} />
              </div>
            ) : activeTab === "Dokumenter" ? (
              <div className="settings-section">
                <h3>Dokumenter</h3>
                <SettingCheck checked={security.auto_process_documents} label="Start behandling automatisk etter opplasting" onChange={(checked) => void updateSecurity({ auto_process_documents: checked })} />
                <SettingCheck checked={security.show_processing_in_case_room} label="Vis behandlingsstatus i Saksrom" onChange={(checked) => void updateSecurity({ show_processing_in_case_room: checked })} />
                <SettingCheck checked={security.hide_technical_details_by_default} label="Skjul tekniske detaljer som standard" onChange={(checked) => void updateSecurity({ hide_technical_details_by_default: checked })} />
                <SettingCheck checked={security.warn_on_large_files} label="Varsle ved store filer" onChange={(checked) => void updateSecurity({ warn_on_large_files: checked })} />
                <SettingCheck checked={security.preserve_originals_locally} label="Bevar originaler lokalt" onChange={(checked) => void updateSecurity({ preserve_originals_locally: checked })} />
                <SettingCheck checked={security.keep_encrypted_copy_only} label="Behold bare kryptert kopi" onChange={(checked) => void updateSecurity({ keep_encrypted_copy_only: checked })} />
                <label className="settings-field">
                  Terskel for foreløpig oppsummering
                  <input type="number" min={50} max={95} value={security.preliminary_summary_threshold} onChange={(event) => void updateSecurity({ preliminary_summary_threshold: Number(event.target.value) })} />
                </label>
                <label className="settings-field">
                  Terskel for utkastkontroll
                  <input type="number" min={80} max={100} value={security.draft_control_threshold} onChange={(event) => void updateSecurity({ draft_control_threshold: Number(event.target.value) })} />
                </label>
              </div>
            ) : activeTab === "AI-provider" ? (
              <div className="settings-section">
                <h3>AI-provider</h3>
                <label className="settings-field">
                  Provider
                  <select value={security.provider_mode} onChange={(event) => void updateSecurity({ provider_mode: event.target.value as SecuritySettings["provider_mode"] })}>
                    <option value="off">Av</option>
                    <option value="local">Lokal</option>
                    <option value="external">Ekstern</option>
                  </select>
                </label>
                <SettingCheck checked={security.external_ai_enabled} label="Tillat ekstern AI-provider" onChange={(checked) => void updateSecurity({ external_ai_enabled: checked, provider_mode: checked ? "external" : "off" })} />
                <SettingCheck checked={security.allow_source_excerpt_sending} label="Tillat sending av korte kildeutdrag" onChange={(checked) => void updateSecurity({ allow_source_excerpt_sending: checked })} />
                <SettingCheck checked={security.allow_full_document_sending} label="Tillat sending av hele dokumenter" onChange={(checked) => void updateSecurity({ allow_full_document_sending: checked })} />
                <SettingCheck checked={security.require_external_ai_confirmation} label="Krev bekreftelse hver gang" onChange={(checked) => void updateSecurity({ require_external_ai_confirmation: checked })} />
                <p className="settings-note">Ekstern AI er av som standard. Hele dokumenter sendes aldri uten at dette eksplisitt aktiveres.</p>
              </div>
            ) : activeTab === "Lagring" ? (
              <div className="settings-section">
                <h3>Lagring</h3>
                <p>{dbSecurity?.database_path || "Databaseplassering er ikke tilgjengelig i nettmodus."}</p>
                <button type="button" className="button-primary" onClick={onOpenDataFolder}>Åpne lokal datamappe</button>
                <button type="button" className="button-secondary" onClick={() => void handleCreateEncryptedBackup()}>Opprett kryptert backup</button>
                <label className="settings-field">
                  Gjenopprett fra backupfil
                  <input value={restorePath} onChange={(event) => setRestorePath(event.target.value)} placeholder="C:\path\to\evida-backup.evida-backup.json" />
                </label>
                <button type="button" className="button-secondary" onClick={() => void handleRestoreEncryptedBackup()}>Gjenopprett kryptert backup</button>
                <SettingCheck checked={security.automatic_local_backup} label="Automatisk lokal backup" onChange={(checked) => void updateSecurity({ automatic_local_backup: checked })} />
                <SettingCheck checked={security.encrypted_backup} label="Kryptert backup" onChange={(checked) => void updateSecurity({ encrypted_backup: checked })} />
                <label className="settings-field">
                  Backup-frekvens
                  <select value={security.backup_frequency} onChange={(event) => void updateSecurity({ backup_frequency: event.target.value as SecuritySettings["backup_frequency"] })}>
                    <option value="off">Av</option>
                    <option value="daily">Daglig</option>
                    <option value="weekly">Ukentlig</option>
                  </select>
                </label>
                <p className="settings-note">Saksmapper bruker alltid intern caseId, ikke saksnavn eller klientnavn.</p>
              </div>
            ) : activeTab === "Tilgjengelighet" ? (
              <div className="settings-section">
                <h3>Tilgjengelighet</h3>
                <label className="settings-field">
                  Tekststørrelse
                  <select value={security.text_size} onChange={(event) => void updateSecurity({ text_size: event.target.value as SecuritySettings["text_size"] })}>
                    <option value="normal">Normal</option>
                    <option value="large">Stor</option>
                    <option value="extra_large">Ekstra stor</option>
                  </select>
                </label>
                <SettingCheck checked={security.high_contrast} label="Høy kontrast" onChange={(checked) => void updateSecurity({ high_contrast: checked })} />
                <SettingCheck checked={security.reduce_motion} label="Reduser bevegelse" onChange={(checked) => void updateSecurity({ reduce_motion: checked })} />
                <SettingCheck checked={security.disable_typewriter_effect} label="Slå av progressiv tekst" onChange={(checked) => void updateSecurity({ disable_typewriter_effect: checked })} />
                <SettingCheck checked={security.disable_auto_scroll_while_answering} label="Slå av auto-scroll mens svar skrives" onChange={(checked) => void updateSecurity({ disable_auto_scroll_while_answering: checked })} />
                <SettingCheck checked={security.announce_import_status} label="Annonser importstatus" onChange={(checked) => void updateSecurity({ announce_import_status: checked })} />
                <SettingCheck checked={security.announce_answer_completion} label="Annonser når svar er ferdig" onChange={(checked) => void updateSecurity({ announce_answer_completion: checked })} />
                <SettingCheck checked={security.announce_summary_ready} label="Annonser når saksoppsummering er klar" onChange={(checked) => void updateSecurity({ announce_summary_ready: checked })} />
              </div>
            ) : activeTab === "Tastatursnarveier" ? (
              <div className="settings-section">
                <h3>Tastatursnarveier</h3>
                <dl className="shortcut-list">
                  <dt>Ctrl+N</dt><dd>Ny sak</dd>
                  <dt>Ctrl+Shift+N</dt><dd>Ny sak i nytt vindu</dd>
                  <dt>Ctrl+O</dt><dd>Åpne tidligere sak</dd>
                  <dt>Ctrl+I</dt><dd>Importer dokumenter</dd>
                  <dt>Ctrl+K</dt><dd>Sakspilot</dd>
                  <dt>Ctrl+F</dt><dd>Finn i saken</dd>
                  <dt>Ctrl+,</dt><dd>Innstillinger</dd>
                  <dt>Ctrl+W</dt><dd>Lukk vindu</dd>
                  <dt>Ctrl+Q</dt><dd>Avslutt</dd>
                </dl>
              </div>
            ) : (
              <div className="settings-section">
                <h3>Om Evida</h3>
                <p>Evida er en lokal, kildebasert saksflate for dokumentimport, kontroll og samtale over dokumentgrunnlaget.</p>
                <p className="settings-note">Status: evaluation build. Ikke bruk ekte klientdata før sikkerhets- og releasekrav er fullført.</p>
              </div>
            )}
            {status ? <p className="notice">{status}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
