import React, { forwardRef } from 'react';
import { Quote, QuoteItem } from '@/types';
import { formatUSD } from '@/lib/utils';

interface QuotePDFLayoutProps {
  quote: Quote;
  currency?: 'usd' | 'bcv';
  bcvMultiplier?: number;
}

export const QuotePDFLayout = forwardRef<HTMLDivElement, QuotePDFLayoutProps>(
  ({ quote, currency = 'usd', bcvMultiplier = 1 }, ref) => {
    const date = new Date(quote.created_at || '').toLocaleDateString('es-VE', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const isBcv = currency === 'bcv';
    const rate = quote.bcv_rate || 1;
    const mult = isBcv ? bcvMultiplier : 1;
    const quoteNumber = quote.id.substring(0, 8).toUpperCase();

    // For BCV: price = usd * multiplier * rate (Bs)
    // For USD: price = usd (dollars)
    const getItemUsdBcv = (usd: number) => usd * mult;
    const getItemBs = (usd: number) => usd * mult * rate;

    // Calculate subtotal from items (without IVA)
    const subtotalUsd = quote.quote_items?.reduce((sum, item) => sum + (item.unit_price_usd || 0) * (item.quantity || 1), 0) || 0;
    const subtotalUsdBcv = subtotalUsd * mult;
    const subtotalBs = subtotalUsdBcv * rate;

    const formatBsVal = (val: number) => `Bs ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const currencyLabel = isBcv ? 'BOLÍVARES (BCV)' : 'DÓLARES (USD)';
    const accentColor = isBcv ? '#2563eb' : '#10b981';
    const accentLight = isBcv ? '#3b82f6' : '#34d399';

    return (
      <div 
        ref={ref} 
        style={{
          width: '820px',
          minWidth: '820px',
          maxWidth: '820px',
          backgroundColor: '#ffffff',
          color: '#1e293b',
          fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
          position: 'relative',
          overflow: 'visible',
          boxSizing: 'border-box',
        }}
      >
        {/* Accent bar top */}
        <div style={{ width: '100%', height: '6px', background: `linear-gradient(90deg, #0f172a 0%, ${accentColor} 50%, #0f172a 100%)` }} />

        {/* Header */}
        <div style={{ 
          width: '100%',
          boxSizing: 'border-box',
          padding: '32px 40px 28px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img 
              src="/LogoRepuestosSotomayor.png" 
              alt="Logo" 
              style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                REPUESTOS SOTOMAYOR
              </h1>
              <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px', letterSpacing: '0.5px' }}>
                Venta de Repuestos Automotrices
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <div style={{ display: 'inline-block', padding: '6px 16px', backgroundColor: '#0f172a', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>COTIZACIÓN</span>
              </div>
              <div style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: isBcv ? '#dbeafe' : '#d1fae5', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: isBcv ? '#1d4ed8' : '#047857', letterSpacing: '1px' }}>{currencyLabel}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>N° {quoteNumber}</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>{date}</p>
          </div>
        </div>

        {/* Client + Payment Info */}
        <div style={{ width: '100%', boxSizing: 'border-box', padding: '24px 40px', display: 'flex', gap: '24px' }}>
          <div style={{ 
            flex: 1, padding: '16px 20px', backgroundColor: '#f8fafc', 
            borderRadius: '10px', border: '1px solid #e2e8f0',
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Cliente</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{quote.client_name || 'Cliente Mostrador'}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>Tel: {quote.client_phone || 'No especificado'}</p>
          </div>
          {isBcv && (
            <div style={{ 
              width: '240px', padding: '16px 20px', 
              backgroundColor: '#eff6ff', 
              borderRadius: '10px', border: '1px solid #bfdbfe',
            }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Tasa BCV</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1d4ed8' }}>Bs {rate.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 40px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#ffffff', backgroundColor: '#0f172a', letterSpacing: '1px', borderRadius: '8px 0 0 0' }}>DESCRIPCIÓN</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#ffffff', backgroundColor: '#0f172a', letterSpacing: '1px', width: '90px' }}>MARCA</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#ffffff', backgroundColor: '#0f172a', letterSpacing: '1px', width: '50px' }}>CANT.</th>
                {isBcv && (
                  <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: '#34d399', backgroundColor: '#0f172a', letterSpacing: '1px', width: '90px' }}>USD BCV</th>
                )}
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: '#ffffff', backgroundColor: '#0f172a', letterSpacing: '1px', width: '100px' }}>P. UNIT.</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: '#ffffff', backgroundColor: '#0f172a', letterSpacing: '1px', width: '100px', borderRadius: '0 8px 0 0' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_items?.map((item: QuoteItem, index: number) => {
                const unitUsdBcv = getItemUsdBcv(item.unit_price_usd);
                const unitBs = getItemBs(item.unit_price_usd);
                const totalBs = unitBs * (item.quantity || 1);
                const totalUsd = item.unit_price_usd * (item.quantity || 1);

                return (
                  <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 500, color: '#1e293b', borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>{item.product_name}</td>
                    <td style={{ padding: '11px 14px', fontSize: '10px', textAlign: 'center', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #f1f5f9', textTransform: 'uppercase' as const }}>
                      {item.brand_logo_url ? (
                        <img src={item.brand_logo_url} alt={item.brand_name || ''} style={{ width: '48px', height: '24px', objectFit: 'contain', display: 'inline-block' }} />
                      ) : (
                        item.brand_name || '—'
                      )}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', textAlign: 'center', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>{item.quantity}</td>
                    {isBcv && (
                      <td style={{ padding: '11px 14px', fontSize: '12px', textAlign: 'right', color: '#10b981', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                        {formatUSD(unitUsdBcv)}
                      </td>
                    )}
                    <td style={{ padding: '11px 14px', fontSize: '13px', textAlign: 'right', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                      {isBcv ? formatBsVal(unitBs) : formatUSD(item.unit_price_usd)}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: '13px', textAlign: 'right', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>
                      {isBcv ? formatBsVal(totalBs) : formatUSD(totalUsd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 40px 32px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '320px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {isBcv ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Subtotal Bs:</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{formatBsVal(subtotalBs)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Ref. USD BCV:</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>{formatUSD(subtotalUsdBcv)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Ref. USD base:</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{formatUSD(subtotalUsd)}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Subtotal:</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{formatUSD(subtotalUsd)}</span>
                </div>
              </>
            )}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', backgroundColor: '#0f172a',
            }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{isBcv ? 'Total Bs:' : 'Total USD:'}</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: accentLight }}>
                {isBcv ? formatBsVal(subtotalBs) : formatUSD(subtotalUsd)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ width: '100%', boxSizing: 'border-box', padding: '20px 40px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
              * Los precios están sujetos a cambio sin previo aviso. Cotización válida por 24 horas.
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Gracias por preferir a Repuestos Sotomayor.
            </p>
          </div>
          <div style={{ padding: '6px 14px', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>
            Página 1 de 1
          </div>
        </div>

        <div style={{ width: '100%', height: '4px', background: `linear-gradient(90deg, #0f172a 0%, ${accentColor} 50%, #0f172a 100%)` }} />
      </div>
    );
  }
);

QuotePDFLayout.displayName = 'QuotePDFLayout';
