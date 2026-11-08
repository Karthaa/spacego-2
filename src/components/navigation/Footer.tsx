"use client";

import React from "react";
import Link from "next/link";
import { Building2, ShieldCheck, Mail, MapPin, Sparkles, ArrowRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[#0B132B] text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-slate-800">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                Space<span className="text-teal-400">Go</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Find the right space. Make every space work. A demand-led platform connecting flexible workspace discovery, property activation, verification, and operations.
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 text-teal-400 font-medium">
                <ShieldCheck className="w-4 h-4" /> Space Passport™ Certified
              </span>
              <span>•</span>
              <span>Demand-Backed Activation</span>
            </div>
          </div>

          {/* Column: For Customers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Explore Workspaces
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link href="/spaces?category=coworking" className="hover:text-teal-400 transition-colors">
                  Coworking Desks
                </Link>
              </li>
              <li>
                <Link href="/spaces?category=private_office" className="hover:text-teal-400 transition-colors">
                  Private Office Suites
                </Link>
              </li>
              <li>
                <Link href="/spaces?category=meeting_room" className="hover:text-teal-400 transition-colors">
                  Executive Boardrooms
                </Link>
              </li>
              <li>
                <Link href="/spaces?category=training_room" className="hover:text-teal-400 transition-colors">
                  Training & Workshop Halls
                </Link>
              </li>
              <li>
                <Link href="/spaces?category=studio" className="hover:text-teal-400 transition-colors">
                  Podcast & Media Studios
                </Link>
              </li>
              <li>
                <Link href="/spaces?category=event_space" className="hover:text-teal-400 transition-colors">
                  Demo & Event Spaces
                </Link>
              </li>
            </ul>
          </div>

          {/* Column: For Property Owners */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              For Property Owners
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link href="/owner" className="hover:text-teal-400 transition-colors">
                  Host Dashboard
                </Link>
              </li>
              <li>
                <Link href="/activation" className="hover:text-teal-400 transition-colors flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  Space Activation Program
                </Link>
              </li>
              <li>
                <Link href="/activation/track" className="hover:text-teal-400 transition-colors">
                  Track Activation Status
                </Link>
              </li>
              <li>
                <Link href="/owner/performance" className="hover:text-teal-400 transition-colors">
                  Owner Economics Model
                </Link>
              </li>
              <li>
                <Link href="/owner/spaces/new" className="hover:text-teal-400 transition-colors">
                  List Ready Space
                </Link>
              </li>
            </ul>
          </div>

          {/* Column: Platform & Trust */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Trust & Platform
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link href="/#passport" className="hover:text-teal-400 transition-colors">
                  Space Passport™ Standards
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-teal-400 transition-colors">
                  How Verification Works
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-teal-400 transition-colors">
                  Admin Console
                </Link>
              </li>
              <li>
                <Link href="/admin/demand" className="hover:text-teal-400 transition-colors">
                  Demand Intelligence
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-teal-400 transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Legal & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} SpaceGo Technologies, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Operating Principle: Verified Authority & Clear Responsibilities</span>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
