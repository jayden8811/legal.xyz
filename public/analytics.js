// Product analytics that can never see content: only these event names are accepted,
// and nothing else (no text, names or ids) is recorded. Counts stay in this browser
// until a backend exists to receive them. Owners can turn this off in Organization.
window.LegalAnalytics = (() => {
  const KEY = "legalxyz.analytics";
  const EVENTS = new Set([
    "onboarding_started", "lawyer_invited", "agreement_signed", "workspace_created", "matter_created",
    "message_sent", "document_uploaded", "template_used", "shared_with_counsel", "export_pdf",
    "export_encrypted", "tour_completed", "referral_requested",
  ]);

  const counts = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };

  const api = {
    enabled: true,
    track(name) {
      if (!api.enabled || !EVENTS.has(name)) return;
      const c = counts();
      c[name] = (c[name] || 0) + 1;
      try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {}
    },
    counts,
  };
  return api;
})();
