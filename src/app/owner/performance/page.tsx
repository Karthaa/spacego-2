"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Percent,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ArrowRight,
} from "lucide-react";

export default function OwnerPerformancePage() {
  // Financial Model Simulator State
  const [desks, setDesks] = useState(16);
  const [operatingDays, setOperatingDays] = useState(22);
  const [deskDayRate, setDeskDayRate] = useState(45);
  const [occupancyRate, setOccupancyRate] = useState(58); // %
  const [commissionRate, setCommissionRate] = useState(15); // %
  const [activationCapex, setActivationCapex] = useState(38000); // $ USD

  // Financial calculations
  const totalDeskDaysAvailable = desks * operatingDays;
  const occupiedDeskDays = Math.round(totalDeskDaysAvailable * (occupancyRate / 100));
  const monthlyGrossRevenue = occupiedDeskDays * deskDayRate;
  const platformFee = Math.round(monthlyGrossRevenue * (commissionRate / 100));
  const netOwnerRemittance = monthlyGrossRevenue - platformFee;
  const annualNetRemittance = netOwnerRemittance * 12;

  // Payback period (months)
  const paybackMonths = netOwnerRemittance > 0 ? (activationCapex / netOwnerRemittance).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
            PropTech Financial Discipline
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Property Unit Economics & Yield
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real transparent financial model covering gross bookings, platform waterfall, and fit-out capital recovery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Current CapEx Payback: <span className="text-teal-700 font-bold">{paybackMonths} Months</span>
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Monthly Gross Value</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(monthlyGrossRevenue)}
          </span>
          <span className="text-[11px] text-teal-700 font-medium">{occupiedDeskDays} desk-days occupied</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Platform Commission ({commissionRate}%)</span>
          <span className="text-2xl font-bold text-slate-700 mt-1 block">
            {formatCurrency(platformFee)}
          </span>
          <span className="text-[11px] text-slate-400">Marketing & booking tools</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Net Monthly Remittance</span>
          <span className="text-2xl font-bold text-teal-600 mt-1 block">
            {formatCurrency(netOwnerRemittance)}
          </span>
          <span className="text-[11px] text-emerald-700 font-semibold">Pre-operating expense</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Annualized Run Rate</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">
            {formatCurrency(annualNetRemittance)}
          </span>
          <span className="text-[11px] text-teal-700 font-medium">Based on {occupancyRate}% occupancy</span>
        </div>
      </div>

      {/* Interactive Scenario Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Input sliders & assumptions */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900">Interactive Yield Model</h3>
            </div>
            <span className="text-xs text-slate-400">Adjust assumptions</span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>Total Bookable Desks / Seats:</span>
                <span className="font-bold text-teal-700">{desks} Desks</span>
              </div>
              <input
                type="range"
                min={4}
                max={60}
                value={desks}
                onChange={(e) => setDesks(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>Achievable Rate Per Occupied Desk-Day ($):</span>
                <span className="font-bold text-teal-700">${deskDayRate} / day</span>
              </div>
              <input
                type="range"
                min={15}
                max={150}
                value={deskDayRate}
                onChange={(e) => setDeskDayRate(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span>Projected Paid Occupancy (%):</span>
                <span className="font-bold text-teal-700">{occupancyRate}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={95}
                value={occupancyRate}
                onChange={(e) => setOccupancyRate(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Input
                label="Operating Days / Month"
                type="number"
                min={15}
                max={31}
                value={operatingDays}
                onChange={(e) => setOperatingDays(Number(e.target.value))}
              />

              <Input
                label="CapEx Investment ($)"
                type="number"
                min={0}
                value={activationCapex}
                onChange={(e) => setActivationCapex(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Right: Revenue Waterfall Breakdown */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Monthly Revenue Waterfall</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent distribution of booking gross value
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Total Bookable Capacity:</span>
              <span className="font-bold text-slate-900">{totalDeskDaysAvailable} desk-days / mo</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Paid Occupied Days ({occupancyRate}%):</span>
              <span className="font-bold text-slate-900">{occupiedDeskDays} desk-days</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-teal-50/60 border border-teal-100 text-teal-950 font-bold">
              <span>Gross Booking Volume:</span>
              <span className="text-sm">{formatCurrency(monthlyGrossRevenue)}</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-600">
              <span>Platform Service Commission ({commissionRate}%):</span>
              <span className="font-semibold text-rose-600">− {formatCurrency(platformFee)}</span>
            </div>

            <div className="flex justify-between p-4 rounded-2xl bg-teal-600 text-white font-bold text-sm shadow-md">
              <span>Net Remittance to Owner:</span>
              <span className="text-base font-bold">{formatCurrency(netOwnerRemittance)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-700 block mb-0.5">Note on Net Owner Contribution:</span>
            Excludes host-side utility, cleaning, localized property taxes, and on-site staff. Actual results vary based on seasonal corporate demand.
          </div>
        </div>

      </div>

    </div>
  );
}
