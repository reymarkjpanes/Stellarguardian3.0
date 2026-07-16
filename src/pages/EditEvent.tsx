import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Button, Input, Select, Textarea } from '../components/ui';
import { toast } from 'sonner';
import { EventStatus } from '../lib/eventStatus';

export default function EditEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const data = await fetchApi(`/events/${id}`);
        if (data.hostUserId !== user?.id) {
          toast.error("Not authorized");
          navigate(`/events/${id}`);
          return;
        }
        setFormData(data);
      } catch (err) {
        toast.error("Failed to load event");
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadEvent();
  }, [id, user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    if (type === 'checkbox') {
      setFormData((prev: any) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : null,
        teamSizeMax: formData.teamSizeMax ? Number(formData.teamSizeMax) : 4
      };
      await fetchApi(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      toast.success("Event updated successfully");
      navigate(`/events/${id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !formData) return <div className="p-12 text-center text-slate-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-black text-slate-900 mb-8">Edit Event Settings</h1>
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
        
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Basic Details</h3>
          <Input label="Event Title" name="title" value={formData.title} onChange={handleChange} required />
          <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} required rows={4} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select label="Category" name="category" value={formData.category} onChange={handleChange}>
              <option value="Hackathon">Hackathon</option>
              <option value="Bounty">Bounty</option>
              <option value="Grant">Grant</option>
              <option value="Design">Design</option>
            </Select>
            <Select label="Format" name="format" value={formData.format} onChange={handleChange}>
              <option value="Online">Online</option>
              <option value="In-person">In-person</option>
              <option value="Hybrid">Hybrid</option>
            </Select>
          </div>
          <Input label="Tags (comma separated)" name="tags" value={formData.tags || ''} onChange={handleChange} />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input type="date" label="Registration Deadline" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleChange} required />
            <Input type="date" label="Start Date" name="startDate" value={formData.startDate} onChange={handleChange} required />
            <Input type="date" label="End Date" name="endDate" value={formData.endDate} onChange={handleChange} required />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Operations & Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Select label="Visibility" name="visibility" value={formData.visibility} onChange={handleChange}>
               <option value="Public">Public (Anyone can apply)</option>
               <option value="Private">Private (Invite only)</option>
             </Select>
             <Input label="Max Team Size" name="teamSizeMax" type="number" min="1" max="10" value={formData.teamSizeMax || 4} onChange={handleChange} required />
             <Input label="Total Capacity" name="capacity" type="number" min="1" placeholder="Unlimited if empty" value={formData.capacity || ''} onChange={handleChange} />
             <Input label="Contact Email" name="contactEmail" type="email" value={formData.contactEmail || ''} onChange={handleChange} required />
          </div>
          <Input label="Banner Image URL" name="bannerUrl" type="url" placeholder="https://example.com/banner.jpg" value={formData.bannerUrl || ''} onChange={handleChange} />
        </div>

        {EventStatus.isDraft(formData.state) && (
          <div className="space-y-4">
             <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Prize Pool</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input type="number" label="Prize Total (XLM)" name="prizeTotal" value={formData.prizeTotal} onChange={handleChange} required min="1" />
              <Input label="Prize Breakdown" name="prizeBreakdown" placeholder="1st: 50%, 2nd: 30%, 3rd: 20%" value={formData.prizeBreakdown} onChange={handleChange} required />
            </div>
          </div>
        )}
        
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2">
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 cursor-pointer">
              <input type="checkbox" name="rulesPublished" checked={!!formData.rulesPublished} onChange={handleChange} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              Rules are published and final
            </label>
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 cursor-pointer">
              <input type="checkbox" name="timelineConfirmed" checked={!!formData.timelineConfirmed} onChange={handleChange} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600" />
              Event timeline is confirmed
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={() => navigate(`/events/${id}`)}>Cancel</Button>
          <Button type="submit" disabled={saving}>Save Settings</Button>
        </div>
      </form>
    </div>
  );
}
