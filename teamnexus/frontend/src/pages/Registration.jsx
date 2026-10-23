import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Crosshair, Zap, CheckCircle2, AlertTriangle, ArrowRight, Printer, Shield, KeyRound, Building2 } from 'lucide-react';
import { api } from '../services/api';
import CameraIdCapture from '../components/CameraIdCapture';

export default function Registration() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    team_name: '',
    college_name: '',
    p1_name: '',
    p1_college: '',
    p1_phone: '',
    p1_roll: '',
    p2_name: '',
    p2_college: '',
    p2_phone: '',
    p2_roll: '',
  });

  const [p1Image, setP1Image] = useState(null); // Data URL or File
  const [p2Image, setP2Image] = useState(null);
  const [p1FileObj, setP1FileObj] = useState(null);
  const [p2FileObj, setP2FileObj] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleP1ImageSelected = (dataUrl, fileName, fileObj = null) => {
    setP1Image(dataUrl);
    setP1FileObj(fileObj);
    setError(null);
  };

  const handleP2ImageSelected = (dataUrl, fileName, fileObj = null) => {
    setP2Image(dataUrl);
    setP2FileObj(fileObj);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // 1. Mandatory Field Validations
    if (!formData.team_name.trim()) {
      setError('Please provide an official Team Name.');
      return;
    }

    if (!formData.college_name.trim()) {
      setError('Please provide the College / Institution Name.');
      return;
    }

    if (!formData.p1_name || !formData.p1_phone || !formData.p1_roll) {
      setError('All fields for Player 1 (Aim Controller) are mandatory.');
      return;
    }

    if (!formData.p2_name || !formData.p2_phone || !formData.p2_roll) {
      setError('All fields for Player 2 (Shoot Controller) are mandatory.');
      return;
    }

    // 2. Phone validation (10 digits)
    const cleanP1Phone = formData.p1_phone.replace(/\D/g, '');
    const cleanP2Phone = formData.p2_phone.replace(/\D/g, '');
    if (cleanP1Phone.length < 10 || cleanP2Phone.length < 10) {
      setError('Please enter valid 10-digit mobile numbers for both participants.');
      return;
    }

    // 3. Mandatory ID Card Upload Check
    if (!p1Image) {
      setError('Player 1 College ID card (camera photo or image upload) is strictly mandatory.');
      return;
    }

    if (!p2Image) {
      setError('Player 2 College ID card (camera photo or image upload) is strictly mandatory.');
      return;
    }

    setLoading(true);

    try {
      // Build submission payload
      const payload = {
        team_name: formData.team_name.trim(),
        college_name: formData.college_name.trim(),
        p1_name: formData.p1_name.trim(),
        p1_college: formData.p1_college.trim() || formData.college_name.trim(),
        p1_phone: cleanP1Phone,
        p1_roll: formData.p1_roll.trim(),
        p1_id_card_data: p1Image,

        p2_name: formData.p2_name.trim(),
        p2_college: formData.p2_college.trim() || formData.college_name.trim(),
        p2_phone: cleanP2Phone,
        p2_roll: formData.p2_roll.trim(),
        p2_id_card_data: p2Image,
      };

      const res = await api.registerTeam(payload);
      if (res.success) {
        setSuccessData(res);
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  // --- CONFIRMATION SCREEN ---
  if (successData) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold mb-1">
            REGISTRATION SUCCESSFUL
          </div>
          <h2 className="text-3xl font-black font-display tracking-tight text-white mb-1">
            {successData.team_name.toUpperCase()}
          </h2>
          <p className="text-slate-400 text-xs mb-6">
            {successData.college_name || 'Verified Institution'} • Queue Ticket #{successData.queue_number}
          </p>

          {/* TEAM ID & ACCESS CODE BADGE */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 mb-6 text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
                  Official Team Identifier (Public)
                </div>
                <div className="text-2xl font-black tracking-wider text-cyan-400 font-mono">
                  {successData.team_code}
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300 font-semibold">
                  Queue #{successData.queue_number}
                </span>
              </div>
            </div>

            {/* Secret Game Access Code */}
            <div className="bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 border border-cyan-500/40 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 font-bold mb-1">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>YOUR GAME ACCESS CODE (SAVE THIS!)</span>
              </div>
              <div className="text-3xl font-black tracking-widest text-white font-mono select-all bg-slate-900/80 px-3 py-2 rounded-lg border border-cyan-500/30 text-center mb-1 shadow-inner">
                {successData.access_code}
              </div>
              <div className="text-[11px] text-amber-200/90 text-center">
                ⚠️ This secret code will only be shown once. You will need it to unlock your 7-minute game session at the game station!
              </div>
            </div>
          </div>

          {/* Event Instructions */}
          <div className="text-xs text-slate-400 bg-slate-800/40 rounded-xl p-4 text-left mb-6 space-y-1.5 border border-slate-800">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Next Steps:</span>
            </div>
            <div>• Proceed to the competition waiting area and watch the <span className="text-cyan-400 font-medium">Live Queue Display</span>.</div>
            <div>• When <span className="text-cyan-400 font-mono font-semibold">{successData.team_code}</span> is called, report to the game station within 30 seconds.</div>
            <div>• Enter your Team ID and Game Access Code at the station to start your official 7-minute match.</div>
            <div>• Player 1 controls WASD (aim) while Player 2 controls SPACE (fire).</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.print()}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save Pass</span>
            </button>
            <button
              onClick={() => navigate('/queue')}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 font-semibold text-xs shadow-lg shadow-cyan-500/25 transition flex items-center justify-center gap-2"
            >
              <span>View Live Queue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSuccessData(null);
                setFormData({
                  team_name: '', college_name: '',
                  p1_name: '', p1_college: '', p1_phone: '', p1_roll: '',
                  p2_name: '', p2_college: '', p2_phone: '', p2_roll: '',
                });
                setP1Image(null);
                setP2Image(null);
                setP1FileObj(null);
                setP2FileObj(null);
              }}
              className="py-3 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 text-xs transition"
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- REGISTRATION FORM ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>2-Player Competitive Event Registration</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-white mb-2">
            AI TARGET STRIKE REGISTRATION
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Form your 2-player team. Capture both college ID cards, obtain your secure game access code, and enter the competition queue.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Team & College Info Section */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Team Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="team_name"
                  value={formData.team_name}
                  onChange={handleInputChange}
                  placeholder="e.g. CYBER TITANS, NEURAL OVERLORDS"
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  College / Institution Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="college_name"
                    value={formData.college_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Sree Sakthi Engineering College"
                    required
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2 Players Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* PLAYER 1: AIM CONTROL (WASD) */}
            <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-cyan-950/20">
              <div className="flex items-center gap-2 mb-4 text-cyan-400 border-b border-slate-800 pb-3">
                <Crosshair className="w-5 h-5" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono">
                  PLAYER 1: AIM CONTROL (WASD)
                </h3>
              </div>

              <div className="space-y-3.5 text-sm">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="p1_name"
                    value={formData.p1_name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Student Roll / Register No *</label>
                  <input
                    type="text"
                    name="p1_roll"
                    value={formData.p1_roll}
                    onChange={handleInputChange}
                    placeholder="e.g. 21CS045"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mobile Phone (10 Digits) *</label>
                  <input
                    type="tel"
                    name="p1_phone"
                    value={formData.p1_phone}
                    onChange={handleInputChange}
                    placeholder="e.g. 9876543210"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {/* Camera / ID Card Upload for P1 */}
                <CameraIdCapture
                  label="Player 1 College ID Card"
                  roleTitle="Player 1 (Aim)"
                  currentPreview={p1Image}
                  onImageSelected={handleP1ImageSelected}
                  accentColor="cyan"
                />
              </div>
            </div>

            {/* PLAYER 2: SHOOT CONTROL (SPACE) */}
            <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-indigo-950/20">
              <div className="flex items-center gap-2 mb-4 text-indigo-400 border-b border-slate-800 pb-3">
                <Zap className="w-5 h-5" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono">
                  PLAYER 2: SHOOT CONTROL (SPACE)
                </h3>
              </div>

              <div className="space-y-3.5 text-sm">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="p2_name"
                    value={formData.p2_name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Student Roll / Register No *</label>
                  <input
                    type="text"
                    name="p2_roll"
                    value={formData.p2_roll}
                    onChange={handleInputChange}
                    placeholder="e.g. 21CS088"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mobile Phone (10 Digits) *</label>
                  <input
                    type="tel"
                    name="p2_phone"
                    value={formData.p2_phone}
                    onChange={handleInputChange}
                    placeholder="e.g. 9876543211"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Camera / ID Card Upload for P2 */}
                <CameraIdCapture
                  label="Player 2 College ID Card"
                  roleTitle="Player 2 (Shoot)"
                  currentPreview={p2Image}
                  onImageSelected={handleP2ImageSelected}
                  accentColor="indigo"
                />
              </div>
            </div>

          </div>

          {/* Privacy & Retention Notice (Section 4 Requirement) */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Data Privacy & ID Card Retention Policy</span>
            </div>
            <div>
              • Uploaded or captured college ID cards and phone numbers are encrypted in a private server vault accessible strictly to authorized event administrators.
            </div>
            <div>
              • Identity documents will NEVER appear on public leaderboards or projector displays and can be purged permanently after the event concludes.
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-base tracking-wide shadow-xl shadow-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>VERIFYING ID CARDS & REGISTERING TEAM...</span>
              </span>
            ) : (
              <span>CONFIRM 2-PLAYER TEAM & GENERATE ACCESS CODE</span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
