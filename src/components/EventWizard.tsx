import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Input, Textarea, Select } from './ui';
import { fetchApi } from '../lib/api';
import { toast } from 'sonner';
import { 
  FileText, 
  Calendar, 
  Users, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Check, 
  AlertCircle,
  Trophy,
  Mail,
  Image as ImageIcon
} from 'lucide-react';

interface EventWizardProps {
  onSuccess?: (eventId: number) => void;
}

export default function EventWizard({ onSuccess }: EventWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom tag states
  const [customTagInput, setCustomTagInput] = useState('');
  
  // Form fields state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Hackathon',
    format: 'Online',
    visibility: 'Public',
    registrationDeadline: '',
    startDate: '',
    endDate: '',
    prizeTotal: 1000,
    prizeBreakdown: '1st: 60%, 2nd: 30%, 3rd: 10%',
    capacity: '',
    teamSizeMax: 4,
    bannerUrl: '',
    contactEmail: ''
  });

  // Checkboxes for Rules step
  const [rulesPublished, setRulesPublished] = useState(true);
  const [timelineConfirmed, setTimelineConfirmed] = useState(true);

  // Tags state
  const [selectedTags, setSelectedTags] = useState<string[]>(['Hackathon']);

  // Inline Validation Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const predefinedTags = ['Workshop', 'Networking', 'Social', 'Hackathon', 'Design', 'Bounty', 'Web3', 'AI'];

  // Real-time Validation Engine
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'title':
        if (!value || typeof value !== 'string' || value.trim() === '') {
          return 'Event title is required.';
        }
        if (value.trim().length < 5) {
          return 'Title must be at least 5 characters.';
        }
        return '';
      case 'description':
        if (!value || typeof value !== 'string' || value.trim() === '') {
          return 'Event description is required.';
        }
        if (value.trim().length < 20) {
          return 'Description must be at least 20 characters.';
        }
        return '';
      case 'registrationDeadline':
        if (!value) return 'Registration deadline is required.';
        if (isNaN(Date.parse(value))) return 'Invalid date format.';
        return '';
      case 'startDate':
        if (!value) return 'Start date is required.';
        if (isNaN(Date.parse(value))) return 'Invalid date format.';
        if (formData.registrationDeadline && new Date(value) < new Date(formData.registrationDeadline)) {
          return 'Start date (kickoff) must be on or after the registration deadline.';
        }
        return '';
      case 'endDate':
        if (!value) return 'End date is required.';
        if (isNaN(Date.parse(value))) return 'Invalid date format.';
        if (formData.startDate && new Date(value) <= new Date(formData.startDate)) {
          return 'End date (submission close) must be after the start date.';
        }
        return '';
      case 'contactEmail':
        if (!value || typeof value !== 'string' || value.trim() === '') {
          return 'Contact email is required.';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address.';
        }
        return '';
      case 'teamSizeMax':
        const size = Number(value);
        if (isNaN(size) || size < 1) return 'Max team size must be at least 1.';
        if (size > 20) return 'Max team size cannot exceed 20.';
        return '';
      case 'capacity':
        if (value === '') return '';
        const cap = Number(value);
        if (isNaN(cap) || cap < 1) return 'Capacity must be at least 1 (or leave blank).';
        return '';
      case 'bannerUrl':
        if (value === '') return '';
        try {
          new URL(value);
          return '';
        } catch (_) {
          return 'Please enter a valid URL (e.g. https://...).';
        }
      case 'prizeTotal':
        const total = Number(value);
        if (isNaN(total) || total < 0) return 'Prize total must be 0 or more.';
        return '';
      case 'prizeBreakdown':
        if (!value || typeof value !== 'string' || value.trim() === '') {
          return 'Prize breakdown description is required.';
        }
        return '';
      default:
        return '';
    }
  };

  // Run validation when field values change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const cleanValue = type === 'number' ? (value === '' ? '' : Number(value)) : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: cleanValue
    }));

    if (touched[name]) {
      const errorMsg = validateField(name, cleanValue);
      setErrors(prev => ({
        ...prev,
        [name]: errorMsg
      }));
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const errorMsg = validateField(name, formData[name as keyof typeof formData]);
    setErrors(prev => ({
      ...prev,
      [name]: errorMsg
    }));
  };

  // Ensure double validation for schedule step if dates are updated
  useEffect(() => {
    if (formData.startDate || formData.endDate || formData.registrationDeadline) {
      const fields = ['registrationDeadline', 'startDate', 'endDate'];
      fields.forEach(field => {
        if (touched[field]) {
          const errorMsg = validateField(field, formData[field as keyof typeof formData]);
          setErrors(prev => ({ ...prev, [field]: errorMsg }));
        }
      });
    }
  }, [formData.registrationDeadline, formData.startDate, formData.endDate]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = customTagInput.trim();
    if (!cleanTag) return;
    const formattedTag = cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1);
    if (selectedTags.includes(formattedTag)) {
      toast.error('Tag already added');
      return;
    }
    setSelectedTags(prev => [...prev, formattedTag]);
    setCustomTagInput('');
  };

  // Step-specific fields validation prior to moving forward
  const isStepValid = (step: number): boolean => {
    let fieldsToValidate: string[] = [];
    if (step === 1) {
      fieldsToValidate = ['title', 'description'];
    } else if (step === 2) {
      fieldsToValidate = ['registrationDeadline', 'startDate', 'endDate'];
    } else if (step === 3) {
      fieldsToValidate = ['contactEmail', 'teamSizeMax', 'capacity', 'bannerUrl'];
    } else if (step === 4) {
      fieldsToValidate = ['prizeTotal', 'prizeBreakdown'];
    }

    // Force touch on all current step fields to display inline errors
    const newTouched = { ...touched };
    const newErrors = { ...errors };
    let hasError = false;

    fieldsToValidate.forEach(field => {
      newTouched[field] = true;
      const errorMsg = validateField(field, formData[field as keyof typeof formData]);
      newErrors[field] = errorMsg;
      if (errorMsg) {
        hasError = true;
      }
    });

    setTouched(newTouched);
    setErrors(newErrors);

    return !hasError;
  };

  const handleNext = () => {
    if (isStepValid(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      toast.error('Please resolve the inline validation errors before proceeding.');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid(1) || !isStepValid(2) || !isStepValid(3) || !isStepValid(4)) {
      toast.error('Please verify all steps have correct data.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        tags: selectedTags,
        capacity: formData.capacity ? Number(formData.capacity) : null,
        rulesPublished: rulesPublished ? 1 : 0,
        timelineConfirmed: timelineConfirmed ? 1 : 0
      };

      const data = await fetchApi('/events', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      toast.success("Event created successfully! Your event is drafted.");
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        navigate(`/events/${data.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event.');
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Basic Info', icon: FileText, desc: 'Name, details, and category' },
    { num: 2, label: 'Schedule', icon: Calendar, desc: 'Registration & kickoff times' },
    { num: 3, label: 'Registration', icon: Users, desc: 'Team bounds & capacity' },
    { num: 4, label: 'Rules & Prizes', icon: ShieldCheck, desc: 'Guidelines, safety, & pool' },
    { num: 5, label: 'Review & Launch', icon: Sparkles, desc: 'Confirm event details' }
  ];

  // Helper to render input error indicators
  const renderError = (fieldName: string) => {
    if (touched[fieldName] && errors[fieldName]) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: -5 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-xs text-red-500 font-medium mt-1.5"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errors[fieldName]}</span>
        </motion.div>
      );
    }
    return null;
  };

  return (
    <div id="event-wizard-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto py-8 px-4">
      
      {/* Left side: Sleek Step Navigation and Progress Bar */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-display font-bold text-slate-900">Event Builder</h2>
            <p className="text-sm text-slate-500">Configure your decentralized event step-by-step.</p>
          </div>

          <div className="space-y-4">
            {steps.map(s => {
              const Icon = s.icon;
              const isActive = s.num === currentStep;
              const isPast = s.num < currentStep;

              return (
                <div 
                  key={s.num} 
                  onClick={() => s.num < currentStep && setCurrentStep(s.num)}
                  className={`flex items-start gap-4 p-3.5 rounded-xl transition-all ${
                    isActive ? 'bg-indigo-50/60 border border-indigo-100' : 
                    isPast ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    isActive ? 'bg-indigo-600 text-white shadow-sm' :
                    isPast ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${
                        isActive ? 'text-indigo-600' : isPast ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        Step {s.num}
                      </span>
                      {isPast && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                          Ready
                        </span>
                      )}
                    </div>
                    <div className={`font-display font-bold text-sm ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                      {s.label}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simple Linear Progress Percentage */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>Overall Progress</span>
              <span>{Math.round(((currentStep - 1) / (steps.length - 1)) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-600 rounded-full"
                animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Step Form Panel (with AnimatePresence) */}
      <div className="lg:col-span-8 flex flex-col gap-8">
        
        {/* Main interactive form */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm flex-1 flex flex-col justify-between">
          <form onSubmit={currentStep === 5 ? handleSubmit : (e) => e.preventDefault()} className="space-y-6">
            <AnimatePresence mode="wait">
              
              {/* PHASE 1: BASIC INFO */}
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      Basic Information
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Provide a clear name and general overview of your decentralized event.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Input 
                        label="Event Title" 
                        name="title" 
                        value={formData.title} 
                        onChange={handleChange}
                        onBlur={() => handleBlur('title')}
                        required 
                        placeholder="e.g. Stellar Frontier Hackathon"
                      />
                      {renderError('title')}
                    </div>

                    <div>
                      <Textarea 
                        label="Description" 
                        name="description" 
                        value={formData.description} 
                        onChange={handleChange}
                        onBlur={() => handleBlur('description')}
                        required 
                        placeholder="Provide a comprehensive breakdown of what the participants will build, judge, and collaborate on..."
                        rows={5}
                      />
                      {renderError('description')}
                    </div>

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

                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-700">Tags</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {predefinedTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              selectedTags.includes(tag) 
                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Or type a custom tag (e.g. Soroban, Security)" 
                          value={customTagInput} 
                          onChange={(e) => setCustomTagInput(e.target.value)} 
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={handleAddCustomTag} className="shrink-0">
                          Add Tag
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PHASE 2: SCHEDULE */}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                      Timeline & Schedule
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Specify date milestones carefully. Make sure kickoff happens after registration closes.</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <Input 
                        label="Registration Deadline" 
                        name="registrationDeadline" 
                        type="date" 
                        value={formData.registrationDeadline} 
                        onChange={handleChange}
                        onBlur={() => handleBlur('registrationDeadline')}
                        required 
                      />
                      {renderError('registrationDeadline')}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Input 
                          label="Start Date (Kickoff)" 
                          name="startDate" 
                          type="date" 
                          value={formData.startDate} 
                          onChange={handleChange}
                          onBlur={() => handleBlur('startDate')}
                          required 
                        />
                        {renderError('startDate')}
                      </div>
                      
                      <div>
                        <Input 
                          label="End Date (Submissions Close)" 
                          name="endDate" 
                          type="date" 
                          value={formData.endDate} 
                          onChange={handleChange}
                          onBlur={() => handleBlur('endDate')}
                          required 
                        />
                        {renderError('endDate')}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-700">Chronological Rules:</p>
                        <p>1. Registration Deadline must be a valid upcoming date.</p>
                        <p>2. Start Date (Kickoff) should ideally begin immediately after registration closes.</p>
                        <p>3. End Date marks the submission cutoff & beginning of evaluation.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PHASE 3: REGISTRATION DETAILS */}
              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Registration & Logistics
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Manage team sizes, global attendee limits, and contact guidelines.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Select label="Visibility" name="visibility" value={formData.visibility} onChange={handleChange}>
                        <option value="Public">Public (Anyone can apply)</option>
                        <option value="Private">Private (Invite only)</option>
                      </Select>

                      <div>
                        <Input 
                          label="Max Team Size" 
                          name="teamSizeMax" 
                          type="number" 
                          min="1" 
                          max="20" 
                          value={formData.teamSizeMax} 
                          onChange={handleChange}
                          onBlur={() => handleBlur('teamSizeMax')}
                          required 
                        />
                        {renderError('teamSizeMax')}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Input 
                          label="Total Capacity (Optional)" 
                          name="capacity" 
                          type="number" 
                          min="1" 
                          placeholder="Leave empty for unlimited" 
                          value={formData.capacity} 
                          onChange={handleChange}
                          onBlur={() => handleBlur('capacity')}
                        />
                        {renderError('capacity')}
                      </div>

                      <div>
                        <Input 
                          label="Organizer Contact Email" 
                          name="contactEmail" 
                          type="email" 
                          placeholder="contact@myorganization.com" 
                          value={formData.contactEmail} 
                          onChange={handleChange}
                          onBlur={() => handleBlur('contactEmail')}
                          required 
                        />
                        {renderError('contactEmail')}
                      </div>
                    </div>

                    <div>
                      <Input 
                        label="Banner Image URL (Optional)" 
                        name="bannerUrl" 
                        type="url" 
                        placeholder="https://example.com/images/banner.jpg" 
                        value={formData.bannerUrl} 
                        onChange={handleChange}
                        onBlur={() => handleBlur('bannerUrl')}
                      />
                      {renderError('bannerUrl')}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PHASE 4: RULES & PRIZES */}
              {currentStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      Rules & Prizes
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Specify prize pools in XLM and agree to publishing standards.</p>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Input 
                          label="Prize Pool Total (XLM)" 
                          name="prizeTotal" 
                          type="number" 
                          min="0" 
                          value={formData.prizeTotal} 
                          onChange={handleChange}
                          onBlur={() => handleBlur('prizeTotal')}
                          required 
                        />
                        {renderError('prizeTotal')}
                      </div>

                      <div>
                        <Input 
                          label="Prize Breakdown Details" 
                          name="prizeBreakdown" 
                          placeholder="e.g. 1st: 60%, 2nd: 30%, 3rd: 10%" 
                          value={formData.prizeBreakdown} 
                          onChange={handleChange}
                          onBlur={() => handleBlur('prizeBreakdown')}
                          required 
                        />
                        {renderError('prizeBreakdown')}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-700">Decentralized Trust Standards</h4>
                      
                      <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/50 border border-slate-150 cursor-pointer hover:bg-slate-50">
                        <input 
                          type="checkbox" 
                          checked={rulesPublished} 
                          onChange={(e) => setRulesPublished(e.target.checked)}
                          className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-sm font-bold text-slate-800">Publish guidelines instantly</div>
                          <p className="text-xs text-slate-500 mt-0.5">Let attendees view terms of participation immediately upon drafting.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/50 border border-slate-150 cursor-pointer hover:bg-slate-50">
                        <input 
                          type="checkbox" 
                          checked={timelineConfirmed} 
                          onChange={(e) => setTimelineConfirmed(e.target.checked)}
                          className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-sm font-bold text-slate-800">Lock chronological milestones</div>
                          <p className="text-xs text-slate-500 mt-0.5">Acknowledge that timelines cannot be modified easily once active.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PHASE 5: REVIEW & PREVIEW */}
              {currentStep === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                      Review & Launch Event
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Review your configurations. Clicking launch creates a Draft event in the registry.</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Title</span>
                        <div className="text-sm font-bold text-slate-950 truncate">{formData.title}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Category & Format</span>
                        <div className="text-sm text-slate-800 font-medium">{formData.category} ({formData.format})</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Timeline Milestones</span>
                        <div className="text-xs text-slate-700 font-medium space-y-1 mt-1">
                          <p>📅 <span className="font-semibold">Reg Deadline:</span> {formData.registrationDeadline}</p>
                          <p>🚀 <span className="font-semibold">Kickoff:</span> {formData.startDate}</p>
                          <p>🏆 <span className="font-semibold">Cutoff & Judging:</span> {formData.endDate}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Rules & Guidelines</span>
                        <div className="text-xs text-slate-700 font-medium space-y-1 mt-1">
                          <p>🔗 <span className="font-semibold">Visibility:</span> {formData.visibility}</p>
                          <p>📋 <span className="font-semibold">Rules Instant Publish:</span> {rulesPublished ? 'Enabled' : 'Disabled'}</p>
                          <p>🔒 <span className="font-semibold">Milestone Lock:</span> {timelineConfirmed ? 'Enabled' : 'Disabled'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Prize Pool</span>
                        <div className="text-base font-extrabold text-indigo-600 flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          {formData.prizeTotal} XLM
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contact Email</span>
                        <div className="text-xs text-slate-700 font-medium break-all">{formData.contactEmail}</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 italic text-center">
                    Note: Once drafted, you will need to fund the escrow with XLM before you can publish.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stepper Buttons */}
            <div className="pt-8 flex justify-between items-center border-t border-slate-100 mt-8">
              {currentStep > 1 ? (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleBack} 
                  className="flex items-center gap-1.5 px-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              ) : (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                  className="px-4"
                >
                  Cancel
                </Button>
              )}

              {currentStep < 5 ? (
                <Button 
                  type="button" 
                  onClick={handleNext} 
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 shadow-sm"
                >
                  Next Step <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 shadow-md shadow-indigo-100"
                >
                  {isSubmitting ? 'Launching...' : 'Create Draft Event'} <Sparkles className="w-4 h-4 text-amber-200" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Live Dynamic Event Preview Card (Split Screen Style) */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin-slow" />
              Live Card Preview
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
              {formData.visibility}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                {formData.category || 'CATEGORY'} • {formData.format || 'FORMAT'}
              </span>
              <h4 className="text-lg font-display font-bold text-white mt-1 line-clamp-1">
                {formData.title || 'Untitled Epic Event'}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                {formData.description || 'Provide details above to watch your customized event description render live...'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Kickoff</div>
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {formData.startDate || 'YYYY-MM-DD'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Prize Pool</div>
                  <div className="text-xs font-extrabold text-white truncate">
                    {formData.prizeTotal ? `${formData.prizeTotal} XLM` : '0 XLM'}
                  </div>
                </div>
              </div>
            </div>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedTags.map(tag => (
                  <span key={tag} className="bg-slate-800/80 text-indigo-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-700">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
