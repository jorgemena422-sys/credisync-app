import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Drawer from './Drawer';
import { apiRequest } from '../utils/api';
import { formatDate, isoToday, moneyWithCurrency, parseNumericInput, round2 } from '../utils/helpers';
import { statusTag } from '../pages/Dashboard';
import { useToast } from '../context/ToastContext';

const DEFAULT_BILLING_INVOICE_NOTE = 'Recuerda hacer el pago antes de la fecha limite para evitar suspencion';
const DEFAULT_CASH_PAYMENT_REFERENCE = 'PAGO EN EFECTIVO';
const MAX_PAYMENT_PROOF_BYTES = 2 * 1024 * 1024;
const MAX_PAYMENT_PROOF_SOURCE_BYTES = 8 * 1024 * 1024;

function buildDraft(subscription) {
    return {
        status: subscription?.status || 'active',
        nextBillingDate: subscription?.nextBillingDate || '',
        notes: subscription?.notes || ''
    };
}

function buildInvoiceDraft(subscription) {
    const amount = Number(subscription?.priceMonthly || 0);
    return {
        amount: amount > 0 ? String(amount) : '',
        dueDate: subscription?.nextBillingDate || isoToday(),
        notes: DEFAULT_BILLING_INVOICE_NOTE
    };
}

function buildPaymentDraft(invoice) {
    const amount = Number(invoice?.outstandingAmount || 0);
    return {
        amount: amount > 0 ? String(round2(amount)) : '',
        method: 'Transferencia',
        reference: '',
        proofImageData: '',
        proofImageName: '',
        proofImageType: ''
    };
}

async function compressPaymentProofImage(file) {
    const imageUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise((resolve, reject) => {
            const nextImage = new Image();
            nextImage.onload = () => resolve(nextImage);
            nextImage.onerror = () => reject(new Error('No se pudo procesar la imagen del comprobante'));
            nextImage.src = imageUrl;
        });

        const maxDimension = 1280;
        const scale = Math.min(1, maxDimension / Math.max(image.width || 1, image.height || 1));
        const targetWidth = Math.max(1, Math.round((image.width || 1) * scale));
        const targetHeight = Math.max(1, Math.round((image.height || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('No se pudo preparar la compresion del comprobante');
        }

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, targetWidth, targetHeight);
        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let estimatedBytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

        while (estimatedBytes > MAX_PAYMENT_PROOF_BYTES && quality > 0.45) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            estimatedBytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);
        }

        if (estimatedBytes > MAX_PAYMENT_PROOF_BYTES) {
            throw new Error('No se pudo comprimir el comprobante por debajo de 2 MB');
        }

        return {
            dataUrl,
            contentType: 'image/jpeg'
        };
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}

export default function SuperadminTenantBillingDrawer({ isOpen, tenantId, initialTab = '', onClose, onSaved }) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [creatingInvoice, setCreatingInvoice] = useState(false);
    const [recordingPayment, setRecordingPayment] = useState(false);
    const [data, setData] = useState(null);
    const [draft, setDraft] = useState(buildDraft());
    const [invoiceDraft, setInvoiceDraft] = useState(buildInvoiceDraft());
    const [paymentDraft, setPaymentDraft] = useState(buildPaymentDraft());
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [invoiceFeedback, setInvoiceFeedback] = useState(null);
    const [paymentFeedback, setPaymentFeedback] = useState(null);
    const [openingInvoiceId, setOpeningInvoiceId] = useState('');
    const invoiceActionRef = useRef(null);
    const paymentActionRef = useRef(null);

    const loadDetail = useCallback(async (activeTenantId, cancelled = false) => {
        try {
            setLoading(true);
            const response = await apiRequest(`/superadmin/tenants/${activeTenantId}/subscription`);
            if (cancelled) {
                return null;
            }
            setData(response);
            setDraft(buildDraft(response?.subscription));
            setInvoiceDraft(buildInvoiceDraft(response?.subscription));
            return response;
        } catch (error) {
            if (!cancelled) {
                setData(null);
                showToast(error.message || 'No se pudo cargar el detalle del tenant');
            }
            return null;
        } finally {
            if (!cancelled) {
                setLoading(false);
            }
        }
    }, [showToast]);

    useEffect(() => {
        if (!isOpen || !tenantId) {
            return undefined;
        }

        let cancelled = false;
        loadDetail(tenantId, cancelled);
        return () => {
            cancelled = true;
        };
    }, [isOpen, tenantId, loadDetail]);

    const invoicesWithBalance = useMemo(() => {
        const confirmedByInvoice = new Map();
        (data?.payments || []).forEach((payment) => {
            if (String(payment?.status || '').toLowerCase() !== 'confirmed' || !payment?.invoiceId) {
                return;
            }
            confirmedByInvoice.set(
                payment.invoiceId,
                round2((confirmedByInvoice.get(payment.invoiceId) || 0) + Number(payment.amount || 0))
            );
        });

        return (data?.invoices || []).map((invoice) => {
            const confirmedPaidAmount = confirmedByInvoice.get(invoice.id) || 0;
            const outstandingAmount = round2(Math.max(Number(invoice.amount || 0) - confirmedPaidAmount, 0));
            const normalizedStatus = String(invoice.status || '').toLowerCase();
            return {
                ...invoice,
                confirmedPaidAmount,
                outstandingAmount,
                isPayable: normalizedStatus !== 'paid' && normalizedStatus !== 'void' && outstandingAmount > 0.009
            };
        });
    }, [data]);

    const latestInvoice = invoicesWithBalance[0] || null;
    const latestPayment = data?.payments?.[0] || null;
    const payableInvoices = useMemo(() => invoicesWithBalance.filter((invoice) => invoice.isPayable), [invoicesWithBalance]);
    const selectedInvoice = useMemo(() => {
        if (!payableInvoices.length) {
            return null;
        }
        return payableInvoices.find((invoice) => invoice.id === selectedInvoiceId) || payableInvoices[0];
    }, [payableInvoices, selectedInvoiceId]);

    const metrics = useMemo(() => {
        return {
            monthly: moneyWithCurrency(data?.subscription?.priceMonthly || 0, data?.subscription?.currency || 'DOP'),
            invoices: invoicesWithBalance.length,
            payments: Array.isArray(data?.payments) ? data.payments.length : 0,
            users: Number(data?.tenant?.usersCount || 0)
        };
    }, [data, invoicesWithBalance]);

    useEffect(() => {
        if (!payableInvoices.length) {
            setSelectedInvoiceId('');
            setPaymentDraft(buildPaymentDraft());
            return;
        }

        const nextInvoice = payableInvoices.find((invoice) => invoice.id === selectedInvoiceId) || payableInvoices[0];
        if (nextInvoice.id !== selectedInvoiceId) {
            setSelectedInvoiceId(nextInvoice.id);
        }
        setPaymentDraft(buildPaymentDraft(nextInvoice));
    }, [payableInvoices, selectedInvoiceId]);

    useEffect(() => {
        if (!isOpen || !data) {
            return undefined;
        }

        const target =
            initialTab === 'payment'
                ? paymentActionRef.current
                : initialTab === 'invoice'
                    ? invoiceActionRef.current
                    : null;

        if (!target) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 180);

        return () => window.clearTimeout(timer);
    }, [data, initialTab, isOpen]);

    const updateDraft = (field, value) => {
        setDraft((prev) => ({ ...prev, [field]: value }));
    };

    const updateInvoiceDraft = (field, value) => {
        setInvoiceDraft((prev) => ({ ...prev, [field]: value }));
    };

    const handleOpenInvoicePdf = async (invoiceId) => {
        const normalized = String(invoiceId || '').trim();
        if (!normalized) {
            showToast('Factura invalida');
            return;
        }

        setOpeningInvoiceId(normalized);
        const candidateUrls = [
            `/api/superadmin/invoices-pdf/${encodeURIComponent(normalized)}`,
            `/api/invoice-pdf/${encodeURIComponent(normalized)}`,
            `/api/superadmin/invoice-pdf/${encodeURIComponent(normalized)}`,
            `/api/superadmin/invoices/${encodeURIComponent(normalized)}/pdf`
        ];

        try {
            let pdfBlob = null;
            for (const url of candidateUrls) {
                const response = await fetch(url, { method: 'GET', credentials: 'include' });
                if (!response.ok) {
                    continue;
                }
                const contentType = String(response.headers.get('content-type') || '').toLowerCase();
                if (!contentType.includes('application/pdf')) {
                    continue;
                }
                pdfBlob = await response.blob();
                break;
            }

            if (!pdfBlob) {
                showToast('No se pudo abrir la factura en PDF. Verifica que el backend de staging este actualizado.');
                return;
            }

            const objectUrl = URL.createObjectURL(pdfBlob);
            const popup = window.open(objectUrl, '_blank', 'noopener,noreferrer');
            if (!popup) {
                URL.revokeObjectURL(objectUrl);
                showToast('El navegador bloqueo la apertura del PDF. Habilita popups e intenta de nuevo.');
                return;
            }

            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        } catch (error) {
            showToast(error.message || 'No se pudo abrir la factura en PDF');
        } finally {
            setOpeningInvoiceId('');
        }
    };

    const updatePaymentDraft = (field, value) => {
        setPaymentDraft((prev) => {
            if (field === 'method') {
                if (value === 'Efectivo') {
                    return {
                        ...prev,
                        method: 'Efectivo',
                        reference: DEFAULT_CASH_PAYMENT_REFERENCE,
                        proofImageData: '',
                        proofImageName: '',
                        proofImageType: ''
                    };
                }
                return {
                    ...prev,
                    method: 'Transferencia',
                    reference: '',
                    proofImageData: '',
                    proofImageName: '',
                    proofImageType: ''
                };
            }
            return { ...prev, [field]: value };
        });
    };

    const clearPaymentProof = () => {
        setPaymentDraft((prev) => ({
            ...prev,
            reference: '',
            proofImageData: '',
            proofImageName: '',
            proofImageType: ''
        }));
    };

    const handlePaymentProofSelected = async (event) => {
        const file = event.target.files?.[0] || null;
        if (!file) {
            clearPaymentProof();
            return;
        }

        if (!String(file.type || '').startsWith('image/')) {
            showToast('El comprobante debe ser una imagen');
            event.target.value = '';
            return;
        }

        if (file.size > MAX_PAYMENT_PROOF_SOURCE_BYTES) {
            showToast('La imagen original es demasiado pesada. Usa una captura de hasta 8 MB');
            event.target.value = '';
            return;
        }

        try {
            const compressed = await compressPaymentProofImage(file);

            setPaymentDraft((prev) => ({
                ...prev,
                reference: file.name || 'comprobante-transferencia',
                proofImageData: compressed.dataUrl,
                proofImageName: file.name || 'comprobante-transferencia',
                proofImageType: compressed.contentType
            }));
        } catch (error) {
            showToast(error.message || 'No se pudo cargar el comprobante');
            event.target.value = '';
        }
    };

    const saveSubscriptionDraft = useCallback(async (nextDraft, successMessage) => {
        if (!tenantId) {
            return null;
        }

        try {
            setSaving(true);
            const response = await apiRequest(`/superadmin/tenants/${tenantId}/subscription`, {
                method: 'PUT',
                body: nextDraft
            });

            const nextSubscription = response?.subscription || null;
            setData((prev) => (prev ? { ...prev, subscription: nextSubscription || prev.subscription } : prev));
            setDraft(buildDraft(nextSubscription));
            if (onSaved) {
                await onSaved();
            }
            if (successMessage) {
                showToast(successMessage);
            }
            return nextSubscription;
        } catch (error) {
            showToast(error.message || 'No se pudo guardar el detalle del tenant');
            return null;
        } finally {
            setSaving(false);
        }
    }, [onSaved, showToast, tenantId]);

    const handleSave = async () => {
        await saveSubscriptionDraft(draft, 'Detalle de suscripcion actualizado');
    };

    const handleQuickStatusChange = async (status) => {
        const nextDraft = {
            ...draft,
            status
        };
        setDraft(nextDraft);
        await saveSubscriptionDraft(
            nextDraft,
            status === 'suspended' ? 'Tenant suspendido correctamente' : 'Tenant reactivado correctamente'
        );
    };

    const handleCreateInvoice = async () => {
        if (!tenantId) {
            return;
        }

        const amount = parseNumericInput(invoiceDraft.amount, NaN);
        if (!Number.isFinite(amount) || amount <= 0) {
            showToast('Indica un monto valido para la factura');
            return;
        }

        try {
            setCreatingInvoice(true);
            const response = await apiRequest(`/superadmin/tenants/${tenantId}/invoices`, {
                method: 'POST',
                body: {
                    amount,
                    dueDate: invoiceDraft.dueDate || data?.subscription?.nextBillingDate || isoToday(),
                    notes: invoiceDraft.notes || DEFAULT_BILLING_INVOICE_NOTE
                }
            });
            const emailDelivery = response?.emailDelivery || null;
            let nextFeedback = null;
            if (emailDelivery?.attempted && emailDelivery?.sent) {
                nextFeedback = {
                    tone: 'success',
                    message: `Factura generada y enviada a ${emailDelivery.sentTo}`
                };
                showToast(`Factura generada y enviada a ${emailDelivery.sentTo}`);
            } else if (emailDelivery?.attempted) {
                nextFeedback = {
                    tone: 'warning',
                    message: emailDelivery?.message || 'Factura generada, pero no se pudo enviar el correo'
                };
                showToast(emailDelivery?.message || 'Factura generada, pero no se pudo enviar el correo');
            } else {
                nextFeedback = {
                    tone: 'success',
                    message: 'Factura generada correctamente'
                };
                showToast('Factura generada correctamente');
            }
            setInvoiceFeedback(nextFeedback);
            await loadDetail(tenantId);
            if (onSaved) {
                await onSaved();
            }
        } catch (error) {
            setInvoiceFeedback({
                tone: 'error',
                message: error.message || 'No se pudo generar la factura'
            });
            showToast(error.message || 'No se pudo generar la factura');
        } finally {
            setCreatingInvoice(false);
        }
    };

    const handleRecordPayment = async () => {
        if (!selectedInvoice?.id) {
            showToast('No hay factura pendiente para registrar el pago');
            return;
        }

        const amount = parseNumericInput(paymentDraft.amount, NaN);
        if (!Number.isFinite(amount) || amount <= 0) {
            showToast('Indica un monto valido para el pago');
            return;
        }

        try {
            setRecordingPayment(true);
            const response = await apiRequest(`/superadmin/invoices/${selectedInvoice.id}/payments`, {
                method: 'POST',
                body: {
                    amount,
                    method: paymentDraft.method || 'Transferencia',
                    reference: paymentDraft.reference || '',
                    proofImageData: paymentDraft.proofImageData || '',
                    proofImageName: paymentDraft.proofImageName || '',
                    proofImageType: paymentDraft.proofImageType || ''
                }
            });
            const emailDelivery = response?.emailDelivery || null;
            let nextFeedback = null;
            if (emailDelivery?.attempted && emailDelivery?.sent) {
                nextFeedback = {
                    tone: 'success',
                    message: `Pago registrado y correo enviado a ${emailDelivery.sentTo}`
                };
            } else if (emailDelivery?.attempted) {
                nextFeedback = {
                    tone: 'warning',
                    message: emailDelivery?.message || 'Pago registrado, pero no se pudo enviar el correo de confirmacion'
                };
            } else {
                nextFeedback = {
                    tone: 'success',
                    message: 'Pago registrado correctamente'
                };
            }
            setPaymentFeedback(nextFeedback);
            await loadDetail(tenantId);
            if (onSaved) {
                await onSaved();
            }
            showToast(nextFeedback.message);
        } catch (error) {
            setPaymentFeedback({
                tone: 'error',
                message: error.message || 'No se pudo registrar el pago'
            });
            showToast(error.message || 'No se pudo registrar el pago');
        } finally {
            setRecordingPayment(false);
        }
    };

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title="Detalle de tenant">
            {loading ? (
                <div className="empty-state">
                    <span className="material-symbols-outlined">hourglass_top</span>
                    <h4>Cargando detalle...</h4>
                </div>
            ) : data ? (
                <div className="drawer-form-shell">
                    <section className="drawer-hero">
                        <div className="drawer-hero-main">
                            <p className="eyebrow">Cuenta SaaS</p>
                            <h2>{data.tenant?.name || tenantId}</h2>
                            <div className="loan-detail-meta-row">
                                {statusTag(data.subscription?.status)}
                                <span className="small muted">{data.tenant?.ownerEmail || 'Sin owner'}</span>
                            </div>
                        </div>

                        <div className="drawer-hero-side">
                            <div className="drawer-stat">
                                <p>Mensualidad</p>
                                <strong>{metrics.monthly}</strong>
                                <small>Plan unificado actual</small>
                            </div>
                            <div className="drawer-stat">
                                <p>Fecha de suspension</p>
                                <strong>{formatDate(data.subscription?.nextBillingDate)}</strong>
                                <small>{latestInvoice ? `Ultima factura: ${latestInvoice.status}` : 'Sin facturas recientes'}</small>
                            </div>
                        </div>
                    </section>

                    <section className="drawer-panel drawer-section">
                        <div className="drawer-section-head">
                            <div>
                                <h4>Control rapido</h4>
                                <p className="muted small">Gestiona el estado de acceso y seguimiento de cobro.</p>
                            </div>
                        </div>

                        <div className="drawer-section-grid">
                            <div className="form-group">
                                <label>Estado</label>
                                <select value={draft.status || 'active'} onChange={(event) => updateDraft('status', event.target.value)} disabled={saving}>
                                    <option value="active">Activa</option>
                                    <option value="suspended">Suspendida</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Fecha de suspension</label>
                                <input
                                    type="date"
                                    value={draft.nextBillingDate || ''}
                                    onChange={(event) => updateDraft('nextBillingDate', event.target.value)}
                                    disabled={saving}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Notas internas</label>
                            <textarea
                                value={draft.notes || ''}
                                onChange={(event) => updateDraft('notes', event.target.value)}
                                disabled={saving}
                                placeholder="Seguimiento comercial, observaciones o acuerdos de pago"
                            />
                        </div>

                        <div className="action-group-inline">
                            <button
                                type="button"
                                className="btn btn-ghost superadmin-inline-action"
                                onClick={() => handleQuickStatusChange('suspended')}
                                disabled={saving || String(data.subscription?.status || '').toLowerCase() === 'suspended'}
                            >
                                Suspender acceso
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost superadmin-inline-action is-positive"
                                onClick={() => handleQuickStatusChange('active')}
                                disabled={saving || String(data.subscription?.status || '').toLowerCase() === 'active'}
                            >
                                Reactivar acceso
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                        </div>
                    </section>

                    <section className="drawer-panel drawer-section">
                        <div className="drawer-section-head">
                            <div>
                                <h4>Acciones de cobro</h4>
                                <p className="muted small">Genera una factura o registra un pago confirmado sin salir de este panel.</p>
                            </div>
                        </div>

                        <div className="superadmin-drawer-actions-grid">
                            <article
                                ref={invoiceActionRef}
                                className={`superadmin-action-card${initialTab === 'invoice' ? ' is-spotlighted' : ''}`}
                            >
                                <div className="superadmin-action-card-head">
                                    <div>
                                        <h5>Generar factura</h5>
                                        <p className="muted small">Usa la mensualidad base actual o ajusta el monto antes de emitir.</p>
                                    </div>
                                    <span className="material-symbols-outlined">receipt_long</span>
                                </div>

                                <div className="drawer-section-grid">
                                    <div className="form-group">
                                        <label>Monto</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={invoiceDraft.amount}
                                            onChange={(event) => updateInvoiceDraft('amount', event.target.value)}
                                            disabled={creatingInvoice}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Vence</label>
                                        <input
                                            type="date"
                                            value={invoiceDraft.dueDate}
                                            onChange={(event) => updateInvoiceDraft('dueDate', event.target.value)}
                                            disabled={creatingInvoice}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Nota de factura</label>
                                    <textarea
                                        value={invoiceDraft.notes}
                                        onChange={(event) => updateInvoiceDraft('notes', event.target.value)}
                                        disabled={creatingInvoice}
                                        placeholder={DEFAULT_BILLING_INVOICE_NOTE}
                                    />
                                </div>

                                {invoiceFeedback ? (
                                    <div className={`superadmin-inline-feedback is-${invoiceFeedback.tone}`} aria-live="polite">
                                        <span className="material-symbols-outlined">
                                            {invoiceFeedback.tone === 'success'
                                                ? 'mark_email_read'
                                                : invoiceFeedback.tone === 'warning'
                                                    ? 'warning'
                                                    : 'error'}
                                        </span>
                                        <p>{invoiceFeedback.message}</p>
                                        <button
                                            type="button"
                                            className="superadmin-inline-feedback-close"
                                            onClick={() => setInvoiceFeedback(null)}
                                            aria-label="Cerrar mensaje"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ) : null}

                                <div className="superadmin-action-card-footer">
                                    <span className="muted small">Monto sugerido: {metrics.monthly}</span>
                                    <button type="button" className="btn btn-primary" onClick={handleCreateInvoice} disabled={creatingInvoice}>
                                        {creatingInvoice ? 'Generando...' : 'Generar factura'}
                                    </button>
                                </div>
                            </article>

                            <article
                                ref={paymentActionRef}
                                className={`superadmin-action-card${initialTab === 'payment' ? ' is-spotlighted' : ''}`}
                            >
                                <div className="superadmin-action-card-head">
                                    <div>
                                        <h5>Registrar pago</h5>
                                        <p className="muted small">Confirma cobros contra una factura pendiente o vencida.</p>
                                    </div>
                                    <span className="material-symbols-outlined">payments</span>
                                </div>

                                {paymentFeedback ? (
                                    <div className={`superadmin-inline-feedback is-${paymentFeedback.tone}`} aria-live="polite">
                                        <span className="material-symbols-outlined">
                                            {paymentFeedback.tone === 'success'
                                                ? 'mark_email_read'
                                                : paymentFeedback.tone === 'warning'
                                                    ? 'warning'
                                                    : 'error'}
                                        </span>
                                        <p>{paymentFeedback.message}</p>
                                        <button
                                            type="button"
                                            className="superadmin-inline-feedback-close"
                                            onClick={() => setPaymentFeedback(null)}
                                            aria-label="Cerrar mensaje"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ) : null}

                                {selectedInvoice ? (
                                    <>
                                        <div className="form-group">
                                            <label>Factura objetivo</label>
                                            <select
                                                value={selectedInvoiceId || selectedInvoice.id}
                                                onChange={(event) => setSelectedInvoiceId(event.target.value)}
                                                disabled={recordingPayment}
                                            >
                                                {payableInvoices.map((invoice) => (
                                                    <option key={invoice.id} value={invoice.id}>
                                                        {`${moneyWithCurrency(invoice.outstandingAmount, invoice.currency || data?.subscription?.currency || 'DOP')} · vence ${formatDate(invoice.dueDate)} · ${invoice.status}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="drawer-section-grid">
                                            <div className="form-group">
                                                <label>Monto a confirmar</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={paymentDraft.amount}
                                                    onChange={(event) => updatePaymentDraft('amount', event.target.value)}
                                                    disabled={recordingPayment}
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Metodo</label>
                                                <select
                                                    value={paymentDraft.method}
                                                    onChange={(event) => updatePaymentDraft('method', event.target.value)}
                                                    disabled={recordingPayment}
                                                >
                                                    <option value="Transferencia">Transferencia</option>
                                                    <option value="Efectivo">Efectivo</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>{paymentDraft.method === 'Transferencia' ? 'Comprobante de transferencia' : 'Referencia'}</label>
                                            {paymentDraft.method === 'Transferencia' ? (
                                                <div className="superadmin-proof-upload">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        capture="environment"
                                                        onChange={handlePaymentProofSelected}
                                                        disabled={recordingPayment}
                                                    />
                                                    <p className="muted small">Adjunta la captura o imagen del comprobante recibido. Maximo 2 MB.</p>
                                                    {paymentDraft.proofImageData ? (
                                                        <div className="superadmin-proof-preview">
                                                            <img src={paymentDraft.proofImageData} alt="Comprobante de transferencia" />
                                                            <div className="superadmin-proof-preview-meta">
                                                                <strong>{paymentDraft.proofImageName || 'Comprobante cargado'}</strong>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost"
                                                                    onClick={clearPaymentProof}
                                                                    disabled={recordingPayment}
                                                                >
                                                                    Quitar comprobante
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="superadmin-proof-placeholder">
                                                            <span className="material-symbols-outlined">upload_file</span>
                                                            <p>Aun no has adjuntado un comprobante.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={paymentDraft.reference}
                                                    disabled
                                                    readOnly
                                                />
                                            )}
                                        </div>

                                        <div className="superadmin-action-card-footer">
                                            <span className="muted small">
                                                Pendiente actual: {moneyWithCurrency(selectedInvoice.outstandingAmount, selectedInvoice.currency || data?.subscription?.currency || 'DOP')}
                                            </span>
                                            <button type="button" className="btn btn-primary" onClick={handleRecordPayment} disabled={recordingPayment}>
                                                {recordingPayment ? 'Registrando...' : 'Registrar pago'}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="empty-state compact-empty-state">
                                        <h4>Sin facturas pendientes</h4>
                                        <p className="muted small">Genera primero una factura para habilitar el registro directo de pago.</p>
                                    </div>
                                )}
                            </article>
                        </div>
                    </section>

                    <section className="drawer-panel drawer-section">
                        <div className="drawer-section-head">
                            <div>
                                <h4>Resumen operativo</h4>
                                <p className="muted small">Contexto rapido del tenant.</p>
                            </div>
                        </div>
                        <div className="drawer-section-grid">
                            <div className="drawer-stat">
                                <p>Usuarios</p>
                                <strong>{metrics.users}</strong>
                                <small>Usuarios asociados</small>
                            </div>
                            <div className="drawer-stat">
                                <p>Facturas</p>
                                <strong>{metrics.invoices}</strong>
                                <small>Historial del tenant</small>
                            </div>
                            <div className="drawer-stat">
                                <p>Pagos</p>
                                <strong>{metrics.payments}</strong>
                                <small>Registros confirmados</small>
                            </div>
                            <div className="drawer-stat">
                                <p>Ultimo pago</p>
                                <strong>{latestPayment ? moneyWithCurrency(latestPayment.amount || 0, latestPayment.currency || data?.subscription?.currency || 'DOP') : '-'}</strong>
                                <small>{latestPayment ? formatDate(latestPayment.receivedAt || latestPayment.createdAt) : 'Sin pagos recientes'}</small>
                            </div>
                        </div>
                    </section>

                    <section className="drawer-panel drawer-section">
                        <div className="drawer-section-head">
                            <div>
                                <h4>Facturas recientes</h4>
                                <p className="muted small">Ultimos cobros emitidos.</p>
                            </div>
                        </div>
                        <div className="payments-list">
                            {invoicesWithBalance.length > 0 ? invoicesWithBalance.slice(0, 6).map((invoice) => (
                                <article
                                    key={invoice.id}
                                    className="payments-list-item superadmin-invoice-item"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleOpenInvoicePdf(invoice.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            handleOpenInvoicePdf(invoice.id);
                                        }
                                    }}
                                    aria-busy={openingInvoiceId === invoice.id}
                                >
                                    <div>
                                        <strong>{moneyWithCurrency(invoice.amount || 0, invoice.currency || data?.subscription?.currency || 'DOP')}</strong>
                                        <p className="muted small">Vence: {formatDate(invoice.dueDate)}</p>
                                        <p className="muted small">Pendiente: {moneyWithCurrency(invoice.outstandingAmount || 0, invoice.currency || data?.subscription?.currency || 'DOP')}</p>
                                    </div>
                                    <div className="superadmin-inline-meta">
                                        {statusTag(invoice.status)}
                                        <span className="muted small">{invoice.id}</span>
                                        <span className="muted small superadmin-invoice-open-copy">
                                            {openingInvoiceId === invoice.id ? 'Abriendo...' : 'Abrir PDF'}
                                        </span>
                                    </div>
                                </article>
                            )) : <div className="empty-state compact-empty-state"><h4>Sin facturas</h4></div>}
                        </div>
                    </section>

                    <section className="drawer-panel drawer-section">
                        <div className="drawer-section-head">
                            <div>
                                <h4>Pagos recientes</h4>
                                <p className="muted small">Ultimos pagos reportados o confirmados.</p>
                            </div>
                        </div>
                        <div className="payments-list">
                            {Array.isArray(data.payments) && data.payments.length > 0 ? data.payments.slice(0, 6).map((payment) => (
                                <article key={payment.id} className="payments-list-item">
                                    <div>
                                        <strong>{moneyWithCurrency(payment.amount || 0, payment.currency || data?.subscription?.currency || 'DOP')}</strong>
                                        <p className="muted small">{payment.method || 'Pago'} | {formatDate(payment.receivedAt || payment.createdAt)}</p>
                                    </div>
                                    <div className="superadmin-inline-meta">
                                        {statusTag(payment.status)}
                                        <span className="muted small">{payment.proofImageName || payment.reference || payment.id}</span>
                                    </div>
                                </article>
                            )) : <div className="empty-state compact-empty-state"><h4>Sin pagos</h4></div>}
                        </div>
                    </section>
                </div>
            ) : (
                <div className="empty-state">
                    <span className="material-symbols-outlined">database_off</span>
                    <h4>Detalle no disponible</h4>
                </div>
            )}
        </Drawer>
    );
}
