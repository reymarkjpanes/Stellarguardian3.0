import React, { useState, useEffect } from 'react';
import { firestoreDb } from '../../lib/googleAuth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Plus, Edit, Trash2, Check, FileText, Sparkles, HelpCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

export interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  creatorId: string;
  createdAt?: any;
}

interface EmailTemplatesProps {
  userId: number | string;
  eventTitle: string;
  inviteRole: string;
  onApplyTemplate: (subject: string, body: string) => void;
}

export function EmailTemplates({ userId, eventTitle, inviteRole, onApplyTemplate }: EmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  const [showPreview, setShowPreview] = useState(false);

  // Variable helpers
  const variables = [
    { key: '{{event_title}}', label: 'Event Title', description: 'The title of this event.' },
    { key: '{{invite_role}}', label: 'Invite Role', description: 'Participant, Judge, or Mentor.' },
    { key: '{{invite_link}}', label: 'Invite Link', description: 'The personalized accept link.' }
  ];

  // Helper to replace template variables for preview
  const resolveTemplate = (text: string) => {
    return text
      .replace(/\{\{event_title\}\}/g, eventTitle)
      .replace(/\{\{invite_role\}\}/g, inviteRole)
      .replace(/\{\{invite_link\}\}/g, 'https://stellar-guardian.org/invite/sample-token');
  };

  // Load templates from Firestore
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const creatorStr = String(userId);
      
      const q = query(
        collection(firestoreDb, 'email_templates'),
        where('creatorId', '==', creatorStr),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const loaded: EmailTemplate[] = [];
      querySnapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as EmailTemplate);
      });
      
      setTemplates(loaded);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      // Fallback to empty array if index is building or other error
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error('All template fields are required.');
      return;
    }

    try {
      const creatorStr = String(userId);
      const templateData = {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        creatorId: creatorStr,
        createdAt: Timestamp.now()
      };

      if (currentTemplateId) {
        // Update template
        const templateRef = doc(firestoreDb, 'email_templates', currentTemplateId);
        await updateDoc(templateRef, templateData);
        toast.success('Template updated successfully!');
      } else {
        // Create template
        await addDoc(collection(firestoreDb, 'email_templates'), templateData);
        toast.success('New template saved successfully!');
      }

      // Reset form & reload
      setName('');
      setSubject('');
      setBody('');
      setCurrentTemplateId(null);
      setIsEditing(false);
      fetchTemplates();
    } catch (err: any) {
      console.error('Error saving template:', err);
      toast.error(err.message || 'Failed to save template.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      const templateRef = doc(firestoreDb, 'email_templates', id);
      await deleteDoc(templateRef);
      toast.success('Template deleted successfully!');
      if (selectedTemplateId === id) {
        setSelectedTemplateId('');
      }
      fetchTemplates();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      toast.error('Failed to delete template.');
    }
  };

  const handleEditClick = (template: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTemplateId(template.id || null);
    setName(template.name);
    setSubject(template.subject);
    setBody(template.body);
    setIsEditing(true);
  };

  const handleApply = (template: EmailTemplate) => {
    setSelectedTemplateId(template.id || '');
    onApplyTemplate(template.subject, template.body);
    toast.success(`Applied "${template.name}" to invitation form!`);
  };

  const insertVariable = (variableKey: string, field: 'subject' | 'body') => {
    if (field === 'subject') {
      setSubject(prev => prev + ' ' + variableKey);
    } else {
      setBody(prev => prev + ' ' + variableKey);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-sm">Invitation Email Templates</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isEditing) {
              setIsEditing(false);
              setCurrentTemplateId(null);
              setName('');
              setSubject('');
              setBody('');
            } else {
              setIsEditing(true);
            }
          }}
          className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
        >
          {isEditing ? 'Cancel' : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Create Template
            </>
          )}
        </button>
      </div>

      <div className="p-6">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {currentTemplateId ? 'Edit Template' : 'Create New Email Template'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Template Name (For your reference)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mentor Invite Template"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. VIP Invitation: join {{event_title}}!"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                />
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-500 self-center">Insert:</span>
                  {variables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key, 'subject')}
                      title={v.description}
                      className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium px-1.5 py-0.5 rounded border border-indigo-100 cursor-pointer"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Email Body / Personal Message
              </label>
              <textarea
                required
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi! We'd love for you to join {{event_title}} as a {{invite_role}}."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 font-sans"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                <div className="flex gap-1.5">
                  <span className="text-[10px] text-slate-500 self-center">Insert:</span>
                  {variables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key, 'body')}
                      title={v.description}
                      className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium px-1.5 py-0.5 rounded border border-indigo-100 cursor-pointer"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showPreview ? 'Hide Live Preview' : 'Show Live Preview'}
                </button>
              </div>
            </div>

            {showPreview && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3 space-y-2">
                <h5 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Live Preview (Placeholder Resolved)
                </h5>
                <div className="text-xs border-b pb-2">
                  <span className="font-bold text-slate-500">Subject:</span>{' '}
                  <span className="text-slate-800 font-semibold">{resolveTemplate(subject) || '(Empty)'}</span>
                </div>
                <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-sans pt-1">
                  {resolveTemplate(body) || '(Empty)'}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setCurrentTemplateId(null);
                  setName('');
                  setSubject('');
                  setBody('');
                }}
                className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-3.5 py-2 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                {currentTemplateId ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Loading saved templates from Firestore...
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed rounded-xl border-slate-200">
                No templates created yet. Click "Create Template" to save your first invitation template.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map((template) => {
                  const isApplied = selectedTemplateId === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleApply(template)}
                      className={`relative p-4 border rounded-xl cursor-pointer transition-all flex flex-col justify-between hover:shadow-sm ${
                        isApplied 
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-600' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="font-bold text-slate-900 text-sm truncate pr-12">
                            {template.name}
                          </h4>
                          <div className="absolute right-3 top-3 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleEditClick(template, e)}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded transition-all cursor-pointer"
                              title="Edit Template"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(template.id!, e)}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-rose-600 rounded transition-all cursor-pointer"
                              title="Delete Template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mb-1 line-clamp-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Subject:</span> {template.subject}
                        </p>
                        <p className="text-xs text-slate-600 line-clamp-2 italic">
                          "{template.body}"
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Click to apply template</span>
                        {isApplied && (
                          <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            Applied
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
