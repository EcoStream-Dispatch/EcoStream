import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { DeviceInfo, DeviceEvent } from '../types';
import { useBackend } from '../context/BackendContext';
import { 
  Cpu, Eye, CheckCircle2, AlertTriangle, Clock, 
  Activity, RefreshCw, Terminal, Layers
} from 'lucide-react';

export const DevicesPage: React.FC = () => {
  const { eventTicker } = useBackend();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data.devices);
      setEvents(data.events);
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [eventTicker]);

  return (
    <div className="py-8 px-4 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Industrial IoT Hardware Gateways</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1">Edge Device Telemetry & Node Status</h1>
          <p className="text-sm text-slate-300">
            Live heartbeat monitoring, AprilTag vision detector feeds, and ESP32 digital tool torque streaming controllers.
          </p>
        </div>

        <button
          onClick={fetchDevices}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Nodes
        </button>
      </div>

      {/* Hardware Node Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {devices.map((d) => {
          const isCamera = d.type === 'camera';

          return (
            <div
              key={d.id}
              className="p-6 rounded-3xl bg-slate-900/60 ring-1 ring-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isCamera ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                  }`}>
                    {isCamera ? <Eye className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-base text-white">{d.name}</div>
                    <div className="text-xs font-mono text-slate-500">{d.id} • {d.location}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-[10px] font-mono text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </div>
              </div>

              {/* Current Readings Box */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="text-slate-500 text-[11px] uppercase">Active Telemetry Payload</div>
                {isCamera ? (
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>Mounted Fixture: <strong className="text-emerald-400">{d.current_readings.fixture_tag}</strong></div>
                    <div>Staged Tray: <strong className="text-emerald-400">{d.current_readings.tray_tag}</strong></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>Preset: <strong className="text-sky-400">{d.current_readings.preset_name}</strong></div>
                    <div>Calibrated Torque: <strong className="text-sky-400">{d.current_readings.torque_nm} Nm</strong></div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
                <span>Heartbeat: {new Date(d.last_heartbeat).toLocaleTimeString()}</span>
                <span className="text-slate-500">HTTP REST Gateway</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw Event Stream Log Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Hardware Telemetry Event Log
          </h2>
          <span className="text-xs font-mono text-slate-500">Live Ingest Queue</span>
        </div>

        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Device Node</th>
                <th className="p-3">Type</th>
                <th className="p-3">Payload Details</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                    Waiting for edge hardware events…
                  </td>
                </tr>
              ) : (
                events.map((ev, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="p-3 text-slate-500">{new Date(ev.timestamp).toLocaleTimeString()}</td>
                    <td className="p-3 font-semibold text-slate-300">{ev.device}</td>
                    <td className="p-3 text-emerald-400 uppercase text-[10px] font-bold">{ev.type}</td>
                    <td className="p-3 text-slate-200">
                      {ev.tag_id && <span>Tag: <strong>{ev.tag_id}</strong> (conf: {ev.confidence})</span>}
                      {ev.preset_id && <span>Preset: <strong>{ev.preset_id}</strong> ({ev.torque_nm} Nm)</span>}
                    </td>
                    <td className="p-3 text-right text-emerald-400 font-bold uppercase text-[10px]">
                      {ev.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
