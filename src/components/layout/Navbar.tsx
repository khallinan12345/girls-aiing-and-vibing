import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Menu, X, Sparkles, LogOut, ShieldCheck } from 'lucide-react';
import classNames from 'classnames';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Admin link visible to leaders and platform administrators
  const isLeaderOrAdmin =
    user?.role === 'leader' ||
    user?.role === 'platform_administrator';

  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navigationLinks = [
    { name: 'Home', path: '/home', shorthand: 'Home' },
    { name: 'English Skills', path: '/english-skills', shorthand: 'English' },
    {
      name: 'Learning',
      shorthand: 'Learning',
      dropdown: [
        { name: 'AI Learning', path: '/learning/ai' },
        { name: 'Skills Development', path: '/learning/skills' },
      ],
    },
    {
      name: 'Tech Skills Workshop',
      shorthand: 'Tech Skills',
      dropdown: [
        { name: 'Vibe Coding', path: '/tech-skills/vibe-coding' },
        { name: 'Vite/React Web Site Development', path: '/tech-skills/web-development' },
        { name: 'Full-Stack App Development', path: '/tech-skills/full-stack-development' },
        { name: 'AI Image Creation', path: '/tech-skills/ai-image-creation' },
        { name: 'AI Voice Creation', path: '/tech-skills/ai-voice-creation' },
        { name: 'AI Video Creation', path: '/tech-skills/ai-video-creation' },
        { name: 'AI Video Studio', path: '/tech-skills/ai-video-studio' },
        { name: 'AI Content Creation', path: '/tech-skills/ai-content-creation' },
        { name: 'AI Workflow Development', path: '/tech-skills/ai-workflow-development' },
        { name: 'AI for Business', path: '/tech-skills/ai-for-business' },
      ],
    },
    {
      name: 'Certifications',
      shorthand: 'Certs',
      dropdown: [
        { name: 'AI Proficiency', path: '/certifications/ai-proficiency' },
        { name: 'AI Ready Skills', path: '/certifications/ai-ready-skills' },
        { name: 'Vibe Coding', path: '/certifications/vibe-coding' },
        { name: 'Web Dev Certification', path: '/certifications/web-dev-certification' },
        { name: 'Full-Stack Certification', path: '/certifications/full-stack-certification' },
        { name: 'AI Video Production', path: '/certifications/ai-video-production' },
        { name: 'AI Image Creation', path: '/certifications/ai-image-creation-cert' },
        { name: 'AI Voice Creation', path: '/certifications/ai-voice-creation' },
        { name: 'AI Workflow Dev', path: '/certifications/ai-workflow-dev' },
        { name: 'AI for Business', path: '/certifications/ai-for-business' },
      ],
    },
    {
      name: 'Community Impact',
      shorthand: 'Community',
      dropdown: [
        { name: 'AI Ambassadors', path: '/community-impact/ai-ambassadors' },
        { name: 'AI Ambassadors Certification', path: '/community-impact/ai-ambassadors/certification' },
        { name: 'Agriculture Consultant', path: '/community-impact/agriculture' },
        { name: 'Agriculture Certification', path: '/community-impact/agriculture/certification' },
        { name: 'Fishing Consultant', path: '/community-impact/fishing' },
        { name: 'Fishing Certification', path: '/community-impact/fishing/certification' },
        { name: 'Healthcare Navigator', path: '/community-impact/healthcare' },
        { name: 'Healthcare Certification', path: '/community-impact/healthcare/certification' },
        { name: 'Entrepreneurship Consultant', path: '/community-impact/entrepreneurship' },
        { name: 'Entrepreneurship Certification', path: '/community-impact/entrepreneurship/certification' },
      ],
    },
    { name: 'Dashboard', path: '/dashboard', shorthand: 'Dashboard' },
    { name: 'AI Playground', path: '/playground', shorthand: 'Claude' },
    { name: 'About', path: '/about', shorthand: 'About' },
  ];

  const isActivePath = (path: string) => {
    if (path === '/home') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    return location.pathname.startsWith(path);
  };

  // Shared style tokens — all items same size, vertically centered via items-stretch + h-full
  const navItemBase =
    'inline-flex items-center h-full px-3 text-sm font-semibold tracking-wide transition-colors whitespace-nowrap';
  const navItemActive =
    'text-purple-700 border-b-2 border-purple-600';
  const navItemIdle =
    'text-gray-600 hover:text-purple-700 border-b-2 border-transparent hover:border-purple-300';

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Brand */}
          <div className="flex-shrink-0">
            <Link to="/home" className="flex items-center gap-1.5 group">
              <Sparkles
                size={20}
                className="text-purple-600 group-hover:text-purple-700 transition-colors"
              />
              <span className="text-sm font-bold text-purple-700 tracking-tight hidden lg:inline">
                Girls AIing
              </span>
            </Link>
          </div>

          {/* Desktop nav — items-stretch so border-b-2 indicators sit flush at bar bottom */}
          <div className="hidden md:flex items-stretch h-full flex-1 min-w-0">
            <div className="flex items-stretch gap-0.5 overflow-x-auto scrollbar-none">
              {navigationLinks.map((link) => {
                if (link.dropdown) {
                  const isAnyActive = link.dropdown.some((item) =>
                    isActivePath(item.path)
                  );
                  return (
                    <div
                      key={link.name}
                      className="relative flex items-stretch"
                      onMouseEnter={() => setOpenDropdown(link.name)}
                      onMouseLeave={() => setOpenDropdown(null)}
                    >
                      <button
                        className={classNames(
                          navItemBase,
                          'gap-1',
                          openDropdown === link.name || isAnyActive
                            ? navItemActive
                            : navItemIdle
                        )}
                      >
                        {link.shorthand}
                        <svg
                          className="w-3 h-3 opacity-40"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {openDropdown === link.name && (
                        <div className="absolute top-full left-0 z-[200] w-full">
                          {/* Transparent bridge — keeps hover zone continuous across the gap */}
                          <div className="h-1 w-full" />
                          <div className="bg-white rounded-md shadow-lg ring-1 ring-black/5 py-1 min-w-[210px]">
                            {link.dropdown.map((item) => (
                              <Link
                                key={item.path}
                                to={item.path}
                                className={classNames(
                                  'block px-4 py-2 text-sm font-medium transition-colors',
                                  isActivePath(item.path)
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                                )}
                              >
                                {item.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.path}
                    to={link.path!}
                    className={classNames(
                      navItemBase,
                      isActivePath(link.path!) ? navItemActive : navItemIdle
                    )}
                  >
                    {link.shorthand}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right-side user actions — same height/font as nav links */}
          <div className="hidden md:flex items-stretch h-full flex-shrink-0 gap-0.5">
            {isLeaderOrAdmin && (
              <Link
                to="/admin/student-dashboard"
                className={classNames(
                  navItemBase,
                  'gap-1.5',
                  isActivePath('/admin/student-dashboard')
                    ? 'text-amber-700 border-b-2 border-amber-500'
                    : 'text-amber-600 hover:text-amber-700 border-b-2 border-transparent hover:border-amber-300'
                )}
              >
                <ShieldCheck size={14} />
                Admin
              </Link>
            )}

            <Link
              to="/profile"
              className={classNames(
                navItemBase,
                isActivePath('/profile') ? navItemActive : navItemIdle
              )}
            >
              Profile
            </Link>

            <button
              onClick={handleSignOut}
              className={classNames(
                navItemBase,
                'gap-1.5 text-gray-500 hover:text-red-600 border-b-2 border-transparent hover:border-red-300'
              )}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-gray-500 hover:text-purple-700 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
            >
              <span className="sr-only">{isOpen ? 'Close menu' : 'Open menu'}</span>
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-0.5">
            {navigationLinks.map((link) => {
              if (link.dropdown) {
                return (
                  <div key={link.name}>
                    <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {link.shorthand}
                    </div>
                    {link.dropdown.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={classNames(
                          'block px-5 py-2 rounded-md text-sm font-medium transition-colors',
                          isActivePath(item.path)
                            ? 'bg-purple-50 text-purple-700'
                            : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                        )}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                );
              }
              return (
                <Link
                  key={link.path}
                  to={link.path!}
                  className={classNames(
                    'block px-3 py-2 rounded-md text-sm font-semibold transition-colors',
                    isActivePath(link.path!)
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {link.shorthand}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-gray-100 px-2 pt-2 pb-3 space-y-0.5">
            {isLeaderOrAdmin && (
              <Link
                to="/admin/student-dashboard"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <ShieldCheck size={14} />
                Admin Dashboard
              </Link>
            )}
            <Link
              to="/profile"
              className="block px-3 py-2 rounded-md text-sm font-semibold text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Profile
            </Link>
            <button
              onClick={() => { handleSignOut(); setIsOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;