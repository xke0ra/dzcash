"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Shield, Upload, Check, X, AlertCircle, FileText,
  Camera, CreditCard, User, ChevronRight
} from 'lucide-react';

type KYCStep = 'id-type' | 'upload-front' | 'upload-back' | 'selfie' | 'review' | 'submitted';
type IDType = 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE';

interface KYCStatus {
  status: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  idType?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export default function KYCPage() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations('common');
  const te = useTranslations('errors');

  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [step, setStep] = useState<KYCStep>('id-type');
  const [idType, setIdType] = useState<IDType>('NATIONAL_ID');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchKYCStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/kyc/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); router.push('/login'); return; }
      if (res.ok) {
        const data = await res.json();
        setKycStatus(data);
      }
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetchKYCStatus();
  }, [token]);

  const handleFileSelect = (file: File | null, setter: (f: File | null) => void, maxSizeMB = 5) => {
    if (!file) { setter(null); return; }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be under ${maxSizeMB}MB`);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP images are accepted');
      return;
    }
    setError(null);
    setter(file);
  };

  const handleSubmit = async () => {
    if (!frontFile || !backFile || !selfieFile) {
      setError('Please upload all required documents');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('idType', idType);
      formData.append('frontImage', frontFile);
      formData.append('backImage', backFile);
      formData.append('selfieImage', selfieFile);

      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || te('submissionFailed'));
      }

      setStep('submitted');
      fetchKYCStatus();
    } catch (err: any) { setError(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400" />
        <p className="text-slate-400 mt-4 text-sm">{t('loading')}</p>
      </div>
    );
  }

  // Already approved
  if (kycStatus?.status === 'APPROVED') {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Shield className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('identityVerified')}</h2>
          <p className="text-slate-400">
            Your identity has been verified successfully. You can now enjoy unrestricted withdrawals and higher limits.
          </p>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 inline-block">
            <p className="text-xs text-emerald-400 font-medium">
              Verified on {kycStatus.reviewedAt ? new Date(kycStatus.reviewedAt).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pending review
  if (kycStatus?.status === 'PENDING') {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('verificationInProgress')}</h2>
          <p className="text-slate-400">
            Your documents are being reviewed by our team. This typically takes 24-48 hours.
          </p>
          <p className="text-xs text-slate-500">
            Submitted {kycStatus.submittedAt ? new Date(kycStatus.submittedAt).toLocaleDateString() : ''}
          </p>
          <button onClick={fetchKYCStatus} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition-colors">
            {t('checkStatus')}
          </button>
        </div>
      </div>
    );
  }

  // Rejected - show reason and allow resubmission
  if (kycStatus?.status === 'REJECTED') {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto">
            <X className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('verificationRejected')}</h2>
          {kycStatus.rejectionReason && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-left">
              <p className="text-xs text-rose-400 font-medium mb-1">Reason:</p>
              <p className="text-sm text-slate-300">{kycStatus.rejectionReason}</p>
            </div>
          )}
          <button
            onClick={() => setStep('id-type')}
            className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-6 py-3 rounded-xl text-sm transition-all"
          >
            {t('resubmitVerification')}
          </button>
        </div>
      </div>
    );
  }

  const FileUploadBox = ({ label, file, setter, accept = 'image/*' }: {
    label: string; file: File | null; setter: (f: File | null) => void; accept?: string;
  }) => (
    <label className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
      file ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 hover:border-sky-500/30 hover:bg-slate-800/50'
    }`}>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handleFileSelect(e.target.files?.[0] || null, setter)}
      />
      {file ? (
        <div className="space-y-2">
          <Check className="w-8 h-8 mx-auto text-emerald-400" />
          <p className="text-sm text-emerald-400 font-medium">{file.name}</p>
          <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          <button
            type="button"
            onClick={e => { e.preventDefault(); setter(null); }}
            className="text-[10px] text-rose-400 hover:text-rose-300 font-medium"
          >
            {t('remove')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="w-8 h-8 mx-auto text-slate-500" />
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-[10px] text-slate-600">JPG, PNG, WebP · Max 5MB</p>
        </div>
      )}
    </label>
  );

  if (step === 'submitted') {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-slate-900 border border-sky-500/20 rounded-2xl p-8 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto">
            <FileText className="w-10 h-10 text-sky-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('documentsSubmitted')}</h2>
          <p className="text-slate-400">
            Thank you! Your identity documents have been submitted successfully.
            Our team will review them within 24-48 hours.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-6 py-3 rounded-xl text-sm transition-all"
          >
            {t('returnToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white">Identity Verification</h1>
        <p className="text-sm text-slate-400 mt-1">
          Verify your identity to unlock higher withdrawal limits and faster payouts.
          Your documents are encrypted and stored securely.
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {[
          { key: 'id-type', label: 'ID Type' },
          { key: 'upload-front', label: 'Front' },
          { key: 'upload-back', label: 'Back' },
          { key: 'selfie', label: 'Selfie' },
          { key: 'review', label: 'Review' },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step === s.key ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-500'
            }`}>
              {i + 1}
            </div>
            <span className={step === s.key ? 'text-sky-400 font-medium' : ''}>{s.label}</span>
            {i < 4 && <ChevronRight className="w-3 h-3 text-slate-700" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Step 1: ID Type Selection */}
      {step === 'id-type' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Select ID Type</h3>
          <p className="text-sm text-slate-400">Choose the type of identification document you will upload.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { value: 'NATIONAL_ID', label: 'National ID', icon: CreditCard, desc: 'ID Card' },
              { value: 'PASSPORT', label: 'Passport', icon: FileText, desc: 'International' },
              { value: 'DRIVERS_LICENSE', label: "Driver's License", icon: CreditCard, desc: 'Driving Permit' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setIdType(opt.value); setStep('upload-front'); }}
                className={`bg-slate-950 border rounded-xl p-4 text-center hover:border-sky-500/30 transition-all ${
                  idType === opt.value ? 'border-sky-500/30 bg-sky-500/5' : 'border-slate-800'
                }`}
              >
                <opt.icon className="w-8 h-8 mx-auto text-sky-400 mb-2" />
                <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                <p className="text-[10px] text-slate-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Upload Front */}
      {step === 'upload-front' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Upload Front Side</h3>
          <p className="text-sm text-slate-400">Upload a clear photo of the front of your {idType.replace('_', ' ').toLowerCase()}.</p>
          <FileUploadBox label="Front of ID" file={frontFile} setter={setFrontFile} />
          <div className="flex justify-between">
            <button onClick={() => setStep('id-type')} className="text-sm text-slate-400 hover:text-white transition-colors">{t('back')}</button>
            <button
              onClick={() => frontFile ? setStep('upload-back') : setError('Please upload the front image')}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all"
            >
              {t('continue')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Upload Back */}
      {step === 'upload-back' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Upload Back Side</h3>
          <p className="text-sm text-slate-400">Upload a clear photo of the back of your {idType.replace('_', ' ').toLowerCase()}.</p>
          <FileUploadBox label="Back of ID" file={backFile} setter={setBackFile} />
          <div className="flex justify-between">
            <button onClick={() => setStep('upload-front')} className="text-sm text-slate-400 hover:text-white transition-colors">{t('back')}</button>
            <button
              onClick={() => backFile ? setStep('selfie') : setError('Please upload the back image')}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all"
            >
              {t('continue')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Selfie */}
      {step === 'selfie' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Take a Selfie</h3>
          <p className="text-sm text-slate-400">
            Take a selfie holding your {idType.replace('_', ' ').toLowerCase()} next to your face.
            Make sure the document details are clearly visible.
          </p>
          <FileUploadBox label="Selfie with ID" file={selfieFile} setter={setSelfieFile} />
          <div className="flex justify-between">
            <button onClick={() => setStep('upload-back')} className="text-sm text-slate-400 hover:text-white transition-colors">{t('back')}</button>
            <button
              onClick={() => selfieFile ? setStep('review') : setError('Please upload a selfie')}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all"
            >
              {t('continue')}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {step === 'review' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Review & Submit</h3>
          <p className="text-sm text-slate-400">Please review your documents before submitting.</p>

          <div className="space-y-3">
            <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">ID Type</p>
                <p className="text-sm font-medium text-slate-200">{idType.replace('_', ' ')}</p>
              </div>
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Front Image</p>
                <p className="text-sm font-medium text-slate-200">{frontFile?.name}</p>
              </div>
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Back Image</p>
                <p className="text-sm font-medium text-slate-200">{backFile?.name}</p>
              </div>
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Selfie</p>
                <p className="text-sm font-medium text-slate-200">{selfieFile?.name}</p>
              </div>
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
            <p className="text-xs text-sky-400">
              By submitting, you confirm that the documents are authentic and belong to you.
              False submissions may result in permanent account suspension.
            </p>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('selfie')} className="text-sm text-slate-400 hover:text-white transition-colors">{t('back')}</button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-8 py-3 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isSubmitting ? t('submitting') : t('submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Clock(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
