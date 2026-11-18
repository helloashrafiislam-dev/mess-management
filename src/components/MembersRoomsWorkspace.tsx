import React, { useMemo, useState } from 'react';
import { BedDouble, Copy, Plus, QrCode, Search, UserPlus, X } from 'lucide-react';
import { formatTaka, toLocalDigits } from '../i18n/translations.js';
import type {
  BedRecord,
  Language,
  MemberRecord,
  MemberStatus,
  MessConfig,
  MessRole,
  RoomRecord,
} from '../shared/types.js';
import { QrCodeSvg } from './QrCodeSvg.js';

interface MembersRoomsWorkspaceProps {
  lang: Language;
  config: MessConfig;
  currentMember: MemberRecord | null;
  members: MemberRecord[];
  rooms: RoomRecord[];
  beds: BedRecord[];
  onAddMember: (payload: {
    name: string;
    phone: string;
    email: string;
    role: MessRole;
    monthlyRent: number;
    bedId: string;
    emergencyContact: string;
  }) => Promise<void>;
  onUpdateMember: (id: string, payload: { role?: MessRole; status?: MemberStatus; monthlyRent?: number }) => Promise<void>;
  onAddRoom: (payload: {
    building: string;
    floor: string;
    roomNumber: string;
    capacity: number;
    defaultRent: number;
  }) => Promise<void>;
  onAssignBed: (bedId: string, membershipId: string | null) => Promise<void>;
}

export const MembersRoomsWorkspace: React.FC<MembersRoomsWorkspaceProps> = ({
  lang,
  config,
  currentMember,
  members,
  rooms,
  beds,
  onAddMember,
  onUpdateMember,
  onAddRoom,
  onAssignBed,
}) => {
  const isBn = lang === 'bn';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [copied, setCopied] = useState(false);

  // Add member form
  const [mName, setMName] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mRole, setMRole] = useState<MessRole>('member');
  const [mRent, setMRent] = useState('4000');
  const [mBedId, setMBedId] = useState('');
  const [mEmergency, setMEmergency] = useState('');

  // Add room form
  const [rBuilding, setRBuilding] = useState('Main Building');
  const [rFloor, setRFloor] = useState('2nd Floor');
  const [rNumber, setRNumber] = useState('');
  const [rCap, setRCap] = useState('2');
  const [rRent, setRRent] = useState('4000');

  const canManageMembers =
    currentMember?.role === 'owner' || Boolean(currentMember?.permissions.manageMembers);

  const emptyBeds = beds.filter((b) => !b.occupantMembershipId);
  const memberById = useMemo(() => {
    const map: Record<string, MemberRecord> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.phone.includes(q) ||
          (m.roomNumber || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [members, statusFilter, search]);

  const handleCopyInvite = () => {
    const inviteText = `Join ${config.name} on MessFlow! Use Invite Code: ${config.inviteCode}`;
    navigator.clipboard?.writeText(inviteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddMember({
      name: mName,
      phone: mPhone,
      email: mEmail,
      role: mRole,
      monthlyRent: Number(mRent) || 0,
      bedId: mBedId,
      emergencyContact: mEmergency,
    });
    setMName('');
    setMPhone('');
    setMEmail('');
    setMBedId('');
    setShowAddMember(false);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddRoom({
      building: rBuilding,
      floor: rFloor,
      roomNumber: rNumber,
      capacity: Number(rCap) || 2,
      defaultRent: Number(rRent) || 4000,
    });
    setRNumber('');
    setShowAddRoom(false);
  };

  return (
    <div className="space-y-8">
      {/* Member Directory Header */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isBn ? 'সদস্য তালিকা ও ভূমিকা' : 'Member Directory'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {toLocalDigits(members.filter((m) => m.status === 'active').length, lang)}{' '}
              {isBn ? 'জন সক্রিয় সদস্য' : 'active'} · {toLocalDigits(emptyBeds.length, lang)}{' '}
              {isBn ? 'টি খালি সিট' : 'empty beds'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>{isBn ? 'আমন্ত্রণ ও কিউআর' : 'Invite & QR'}</span>
            </button>

            {canManageMembers && (
              <button
                onClick={() => setShowAddMember(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isBn ? 'নতুন সদস্য যোগ' : 'Add Member'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isBn ? 'নাম, ফোন বা রুম খুঁজুন...' : 'Search name, phone, room...'}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
            {(['all', 'active', 'away', 'leaving_soon', 'left'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Member Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-6">{isBn ? 'নাম ও যোগাযোগ' : 'Member & Contact'}</th>
                <th className="py-3 px-4">{isBn ? 'রুম ও সিট' : 'Room & Bed'}</th>
                <th className="py-3 px-4">{isBn ? 'ভূমিকা' : 'Role'}</th>
                <th className="py-3 px-4">{isBn ? 'অবস্থা' : 'Status'}</th>
                <th className="py-3 px-6 text-right">{isBn ? 'মাসিক ভাড়া' : 'Monthly Rent'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredMembers.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-6">
                    <div className="font-medium text-slate-900 dark:text-white">{m.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {m.phone} · Joined {m.joinedAt}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                    {m.roomNumber ? `Room ${m.roomNumber} · ${m.bedLabel}` : 'Unassigned'}
                  </td>
                  <td className="py-3.5 px-4">
                    {canManageMembers && m.role !== 'owner' ? (
                      <select
                        value={m.role}
                        onChange={(e) => onUpdateMember(m.id, { role: e.target.value as MessRole })}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium capitalize"
                      >
                        <option value="manager">Manager</option>
                        <option value="accountant">Accountant</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className="capitalize text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {canManageMembers ? (
                      <select
                        value={m.status}
                        onChange={(e) => onUpdateMember(m.id, { status: e.target.value as MemberStatus })}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs capitalize"
                      >
                        <option value="active">Active</option>
                        <option value="away">Away</option>
                        <option value="leaving_soon">Leaving Soon</option>
                        <option value="left">Left</option>
                      </select>
                    ) : (
                      <span className="capitalize text-xs text-slate-600 dark:text-slate-400">
                        {m.status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatTaka(m.monthlyRent, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Visual Room & Bed Occupancy Board */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isBn ? 'রুম ও সিট ম্যাপ' : 'Rooms & Bed Occupancy'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn
                ? `${toLocalDigits(rooms.length, lang)}টি রুম · ${toLocalDigits(beds.length - emptyBeds.length, lang)}/${toLocalDigits(beds.length, lang)}টি সিট পূর্ণ`
                : `${rooms.length} rooms · ${beds.length - emptyBeds.length}/${beds.length} beds occupied`}
            </p>
          </div>

          {canManageMembers && (
            <button
              onClick={() => setShowAddRoom(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isBn ? 'রুম যোগ করুন' : 'Add Room'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rooms.map((room) => {
            const roomBeds = beds.filter((b) => b.roomId === room.id);
            const occupiedCount = roomBeds.filter((b) => b.occupantMembershipId).length;
            return (
              <div
                key={room.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Room {room.roomNumber}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {room.building} · {room.floor}
                    </div>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {occupiedCount}/{roomBeds.length} occupied · {formatTaka(room.defaultRent, lang)}
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {roomBeds.map((bed) => {
                    const occupant = bed.occupantMembershipId
                      ? memberById[bed.occupantMembershipId]
                      : null;
                    return (
                      <div
                        key={bed.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30"
                      >
                        <div className="flex items-center gap-2.5">
                          <BedDouble
                            className={`w-4 h-4 ${
                              occupant ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'
                            }`}
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {bed.bedLabel}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {occupant ? occupant.name : isBn ? 'খালি সিট' : 'Empty bed'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400">
                            {formatTaka(bed.monthlyRent, lang)}
                          </span>
                          {canManageMembers && (
                            <select
                              value={bed.occupantMembershipId || ''}
                              onChange={(e) => onAssignBed(bed.id, e.target.value || null)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs max-w-[125px]"
                            >
                              <option value="">{isBn ? 'খালি রাখুন' : 'Unassign'}</option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Invite QR Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {isBn ? 'সদস্য আমন্ত্রণ কোড' : 'Member Invite & QR'}
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex justify-center">
              <QrCodeSvg value={config.inviteCode} size={160} />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{config.name}</div>
              <div className="mt-1 font-mono text-2xl font-bold tracking-widest text-emerald-700 dark:text-emerald-400">
                {config.inviteCode}
              </div>
            </div>
            <button
              onClick={handleCopyInvite}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>{copied ? (isBn ? 'কপি হয়েছে' : 'Copied Invite Text') : isBn ? 'আমন্ত্রণ কপি করুন' : 'Copy Invite Link & Code'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateMember}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {isBn ? 'নতুন সদস্য যুক্ত করুন' : 'Add New Mess Member'}
              </h3>
              <button type="button" onClick={() => setShowAddMember(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <input
              required
              value={mName}
              onChange={(e) => setMName(e.target.value)}
              placeholder="Full Name (e.g. Mehedi Hasan)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                value={mPhone}
                onChange={(e) => setMPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
              <input
                value={mEmail}
                onChange={(e) => setMEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={mRole}
                onChange={(e) => setMRole(e.target.value as MessRole)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
              </select>
              <input
                type="number"
                value={mRent}
                onChange={(e) => setMRent(e.target.value)}
                placeholder="Monthly Rent ৳"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
            <select
              value={mBedId}
              onChange={(e) => setMBedId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            >
              <option value="">Assign Empty Bed (Optional)</option>
              {emptyBeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bedLabel} (৳{b.monthlyRent})
                </option>
              ))}
            </select>
            <input
              value={mEmergency}
              onChange={(e) => setMEmergency(e.target.value)}
              placeholder="Emergency Contact Phone"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer"
            >
              {isBn ? 'সদস্য সংরক্ষণ করুন' : 'Create Member'}
            </button>
          </form>
        </div>
      )}

      {/* Add Room Modal */}
      {showAddRoom && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRoom}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {isBn ? 'নতুন রুম যুক্ত করুন' : 'Add Room & Beds'}
              </h3>
              <button type="button" onClick={() => setShowAddRoom(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={rBuilding}
                onChange={(e) => setRBuilding(e.target.value)}
                placeholder="Building"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                value={rFloor}
                onChange={(e) => setRFloor(e.target.value)}
                placeholder="Floor"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                required
                value={rNumber}
                onChange={(e) => setRNumber(e.target.value)}
                placeholder="Room # (301)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="number"
                min="1"
                max="10"
                value={rCap}
                onChange={(e) => setRCap(e.target.value)}
                placeholder="Beds"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
              <input
                type="number"
                value={rRent}
                onChange={(e) => setRRent(e.target.value)}
                placeholder="Rent ৳"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium cursor-pointer"
            >
              {isBn ? 'রুম তৈরি করুন' : 'Create Room & Generate Beds'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
