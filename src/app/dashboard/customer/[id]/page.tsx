"use client";

import { useState, useEffect, useCallback, use } from 'react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// Reusable spinner component
function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} text-blue-600`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  customer_created: { label: 'Customer Created', color: 'bg-green-100 text-green-800' },
  customer_updated: { label: 'Customer Updated', color: 'bg-blue-100 text-blue-800' },
  customer_deleted: { label: 'Customer Deleted', color: 'bg-red-100 text-red-800' },
  customer_restored: { label: 'Customer Restored', color: 'bg-yellow-100 text-yellow-800' },
  note_added: { label: 'Note Added', color: 'bg-purple-100 text-purple-800' },
  customer_assigned: { label: 'Customer Assigned', color: 'bg-indigo-100 text-indigo-800' },
};

function ActionBadge({ action }: { action: string }) {
  const info = ACTION_LABELS[action] || {
    label: action.replace(/_/g, ' '),
    color: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${info.color}`}>
      {info.label}
    </span>
  );
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const { user } = useAuth();
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  const fetchCustomerData = useCallback(async () => {
    try {
      const [customerData, notesData, logsData] = await Promise.all([
        fetchApi(`/customers/${id}`),
        fetchApi(`/notes/customer/${id}`),
        fetchApi(`/activity-logs/customer/${id}`)
      ]);
      setCustomer(customerData);
      setNotes(notesData);
      setLogs(logsData);

      if (user?.role === 'admin') {
        try {
          const usersData = await fetchApi(`/users`);
          setUsers(usersData);
        } catch (userErr) {
          console.error('Failed to fetch users for dropdown:', userErr);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNoteError('');
    setIsSavingNote(true);
    try {
      await fetchApi('/notes', {
        method: 'POST',
        body: JSON.stringify({ customerId: id, content: newNote })
      });
      setNewNote('');
      fetchCustomerData();
    } catch (err: any) {
      setNoteError(err.message || 'Failed to add note');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId) return;
    setIsAssigning(true);
    try {
      await fetchApi(`/customers/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId: assignUserId })
      });
      setAssignUserId('');
      fetchCustomerData();
      alert('Successfully assigned');
    } catch (err: any) {
      alert(err.message || 'Failed to assign');
    } finally {
      setIsAssigning(false);
    }
  };

  // Full-page loading state with spinner
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-gray-500">
        <Spinner size="lg" />
        <span className="text-sm">Loading customer details...</span>
      </div>
    );
  }

  if (!customer) {
    return <div className="p-8 text-center text-red-500">Customer not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-900 transition-colors text-sm font-medium">
            ← Back to Customers
          </Link>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          {user?.role === 'admin' && customer.organization && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {customer.organization.name}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details + Assign + Notes */}
        <div className="lg:col-span-2 space-y-6">

          {/* Customer Details Card */}
          <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.email || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.phone || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {customer.assignedTo ? (
                    <span className="inline-flex items-center space-x-1">
                      <span className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                        {customer.assignedTo.name.charAt(0).toUpperCase()}
                      </span>
                      <span>{customer.assignedTo.name}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">Unassigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Assign Customer Card (Admin only) */}
          {user?.role === 'admin' && (
            <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Assign Customer</h2>
              <form onSubmit={handleAssign} className="flex space-x-3">
                <select
                  required
                  className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={assignUserId}
                  onChange={e => setAssignUserId(e.target.value)}
                >
                  <option value="" disabled>Select User to assign...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {isAssigning && <Spinner size="sm" />}
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </button>
              </form>
              <p className="mt-2 text-xs text-gray-500">Note: A user can have max 5 active customers assigned.</p>
            </div>
          )}

          {/* Notes Card - visible to both Admin and Member */}
          <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Notes</h2>

            {/* Add Note Form - Both Admin and User can add notes */}
            <form onSubmit={handleAddNote} className="mb-6">
              <textarea
                rows={3}
                required
                placeholder="Add a new note..."
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              {noteError && (
                <p className="mt-1 text-xs text-red-600">{noteError}</p>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingNote}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-70"
                >
                  {isSavingNote && <Spinner size="sm" />}
                  {isSavingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No notes yet. Add the first note above.</p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-gray-50 rounded-md p-4 border border-gray-100">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{note.content}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Added by <span className="font-medium text-gray-700">{note.createdBy?.name}</span> on{' '}
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity Log as fixed Datatable (no horizontal scroll) */}
        <div className="bg-white shadow rounded-lg border border-gray-200 p-6 h-fit">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Activity Log</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No activity yet.</p>
          ) : (
            /* table-fixed prevents horizontal overflow by respecting set widths */
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-[45%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="w-[30%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">By</th>
                  <th className="w-[25%] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs truncate">
                      {log.performedBy?.name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-gray-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
