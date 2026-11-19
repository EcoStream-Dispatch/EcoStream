import {
  Variant, Sop, StationState, ChangeoverSession, DigitalPassport,
  PocTrial, Truck, Alert, DiagnoseResponse, ExplainResponse,
  DeviceInfo, DeviceEvent
} from '../types';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8780';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE.replace(/\/$/, '')}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let detail = `Error ${res.status}: ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.detail) detail = body.detail;
      } catch {
        // fallback
      }
      const err = new Error(detail);
      (err as any).status = res.status;
      throw err;
    }
    return await res.json();
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error(`Cannot connect to EcoStream backend at ${API_BASE}. Server may be sleeping or offline.`);
    }
    throw err;
  }
}

export const api = {
  // Common
  checkHealth: () => request<{ status: string; state_version: number; timestamp: string }>('/api/health'),
  getStateVersion: () => request<{ version: number; timestamp: string }>('/api/state/version'),
  resetSim: () => request<{ status: string; message: string }>('/api/sim/reset', { method: 'POST' }),

  // Module 1
  getVariants: () => request<Variant[]>('/api/variants'),
  getSops: () => request<Sop[]>('/api/sops'),
  getStation: () => request<StationState>('/api/station'),
  updateSimStation: (payload: Partial<StationState>) => 
    request<StationState>('/api/sim/station', { method: 'POST', body: JSON.stringify(payload) }),
  sendTagDetection: (tag_id: string, tag_type: 'fixture' | 'tray') =>
    request('/api/device/tag-detections', { method: 'POST', body: JSON.stringify({ tag_id, tag_type }) }),
  sendToolPreset: (preset_id: string, preset_name: string, torque_nm: number) =>
    request('/api/device/tool-preset', { method: 'POST', body: JSON.stringify({ preset_id, preset_name, torque_nm }) }),
  
  startChangeover: (to_variant: string, operator: string) =>
    request<ChangeoverSession>('/api/changeovers', { method: 'POST', body: JSON.stringify({ to_variant, operator }) }),
  getChangeovers: () => request<ChangeoverSession[]>('/api/changeovers'),
  getChangeover: (id: string) => request<ChangeoverSession>(`/api/changeovers/${id}`),
  reloadSop: (id: string) => request<ChangeoverSession>(`/api/changeovers/${id}/reload-sop`, { method: 'POST' }),
  
  verifyStep: (id: string, step_id: string) =>
    request<{ passed: boolean; message: string; step_id: string; deviation?: any; session: ChangeoverSession }>(
      `/api/changeovers/${id}/steps/${step_id}/verify`, { method: 'POST' }
    ),
  confirmStep: (id: string, step_id: string, notes?: string) =>
    request<{ passed: boolean; message: string; session: ChangeoverSession }>(
      `/api/changeovers/${id}/steps/${step_id}/confirm`, { method: 'POST', body: JSON.stringify({ notes }) }
    ),
  requestApproval: (id: string) =>
    request<{ status: string; message: string }>(`/api/changeovers/${id}/request-approval`, { method: 'POST' }),
  approveChangeover: (id: string, pin: string, supervisor: string, notes?: string) =>
    request<DigitalPassport>(`/api/changeovers/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ pin, supervisor, notes })
    }),
  rejectChangeover: (id: string, reason: string, supervisor: string) =>
    request<ChangeoverSession>(`/api/changeovers/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, supervisor })
    }),
  
  getPassports: () => request<DigitalPassport[]>('/api/passports'),
  getPassport: (id: string) => request<DigitalPassport>(`/api/passports/${id}`),

  // POC Trials
  getPocTrials: () => request<PocTrial[]>('/api/poc/trials'),
  createPocTrial: (trial: PocTrial) => request<PocTrial>('/api/poc/trials', { method: 'POST', body: JSON.stringify(trial) }),
  clearPocTrials: () => request<{ status: string; message: string }>('/api/poc/trials', { method: 'DELETE' }),

  getExplain: (payload: { fault_type: string; expected?: string; actual?: string; step_id?: string }) =>
    request<ExplainResponse>('/api/explain', { method: 'POST', body: JSON.stringify(payload) }),

  // Module 2 Fleet
  getFleet: () => request<Truck[]>('/api/fleet'),
  getTruck: (id: string) => request<Truck>(`/api/fleet/${id}`),
  getAlerts: () => request<Alert[]>('/api/alerts'),
  acknowledgeAlert: (id: string) => request<{ status: string; alert: Alert }>(`/api/alerts/${id}/ack`, { method: 'POST' }),
  resolveAlert: (id: string) => request<{ status: string; alert: Alert }>(`/api/alerts/${id}/resolve`, { method: 'POST' }),
  injectFleetScenario: (truck_id: string, tyre: string, scenario: 'slow_leak' | 'sudden_drop' | 'overheat' | 'clear') =>
    request('/api/sim/inject', { method: 'POST', body: JSON.stringify({ truck_id, tyre, scenario }) }),
  diagnoseTyre: (truck_id: string, tyre: string, question?: string) =>
    request<DiagnoseResponse>('/api/diagnose', { method: 'POST', body: JSON.stringify({ truck_id, tyre, question }) }),

  // Devices
  getDevices: () => request<{ devices: DeviceInfo[]; events: DeviceEvent[] }>('/api/devices')
};
