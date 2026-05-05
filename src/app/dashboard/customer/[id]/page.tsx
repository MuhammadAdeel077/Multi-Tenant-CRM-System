"use client";

import { useState, useEffect, useCallback, use } from 'react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

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

      try {
        const usersData = await fetchApi(`/users`);
        setUsers(usersData);
      } catch (userErr) {
        console.error('Failed to fetch users for dropdown:', userErr);
        // We don't fail the whole page, users just stays empty
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      await fetchApi('/notes', {
        method: 'POST',
        body: JSON.stringify({ customerId: id, content: newNote })
      });
      setNewNote('');
      fetchCustomerData(); // refresh to get new note and new activity log
    } catch (err) {
      alert('Failed to add note');
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

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!customer) return <div className="p-8 text-center text-red-500">Customer not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className=" hover:text-gray-900 transition-colors">
            &larr; Back to Customers
          </Link>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
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
                  {customer.assignedTo ? customer.assignedTo.name : 'Unassigned'}
                </dd>
              </div>
            </dl>
          </div>

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
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {isAssigning ? 'Assigning...' : 'Assign'}
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-500">Note: A user can have max 5 active customers assigned.</p>
          </div>

          <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Notes</h2>
            <form onSubmit={handleAddNote} className="mb-6">
              <textarea
                rows={3}
                required
                placeholder="Add a new note..."
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Save Note
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No notes available.</p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Added by {note.createdBy?.name} on {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg border border-gray-200 p-6 h-fit">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Activity Log</h2>
          <div className="flow-root">
            <ul className="-mb-8">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500">No activity yet.</p>
              ) : (
                logs.map((log, logIdx) => (
                  <li key={log.id}>
                    <div className="relative pb-8">
                      {logIdx !== logs.length - 1 ? (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center ring-8 ring-white">
                            <span className="text-blue-500 text-xs font-medium">L</span>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium text-gray-900">{log.performedBy?.name}</span>{' '}
                              {log.action.replace('_', ' ')}
                            </p>
                          </div>
                          <div className="text-right text-xs whitespace-nowrap text-gray-500">
                            <time dateTime={log.timestamp}>{new Date(log.timestamp).toLocaleDateString()}</time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
