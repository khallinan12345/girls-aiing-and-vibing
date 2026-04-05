import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Menu, X, Sparkles, LogOut, Globe2, ShieldCheck } from 'lucide-react';
import classNames from 'classnames';

const ADMIN_IDS = new Set([
  '0e738663-a70e-4fd3-9ba6-718c02e116c2',
  '5d5e0486-e768-4c5d-ba63-d1e4570a352d',
  '8b3f70dc-e5d0-4eb0-af7d-ec6181968213',
]);

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN_IDS.has(user.id);
  const [isOpen, setIsOpen] = useState(false);

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
      shorthand: 'Tech Workshop',
      dropdown: [
        { name: 'Vibe Coding', path: '/tech-skills/vibe-coding' },
        { name: 'Vite/React Web Site Development', path: '/tech-skills/web-development' },
        { name: 'Full-Stack App Development', path: '/tech-skills/full-stack-development' },
        { name: 'AI Image Creation', path: '/tech-skills/ai-image-creation' },
        { name: 'AI Voice Creation', path: '/tech-skills/ai-voice-creation' },
        { name: 'AI Video Creation', path: '/tech-skills/ai-video-creation' },
        { name: 'AI Video Studio',   path: '/tech-skills/ai-video-studio' },
        { name: 'AI Content Creation', path: '/tech-skills/ai-content-creation' },
        { name: 'AI Workflow Development', path: '/tech-skills/ai-workflow-development' },
        { name: 'AI for Business', path: '/tech-skills/ai-for-business' },
      ],
    },
    {
      name: 'Certifications',
      shorthand: 'Certifications',
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
    { name: 'AI Playground', path: '/playground', shorthand: 'Use Claude' },
    { name: 'About', path: '/about', shorthand: 'About' },
  ];

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isActivePath = (path: string) => {
    if (path === '/home') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-white/95 backdrop-blur-sm shadow-md border-b border-purple-100/50 sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo */}
          <div className="flex-shrink-0">
            <Link to="/home" className="flex items-center">
              <Sparkles size={24} className="text-purple-600" />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex md:space-x-2">
            {navigationLinks.map((link) => {
              if (link.dropdown) {
                return (
                  <div
                    key={link.name}
                    className="relative"
                    onMouseEnter={() => setOpenDropdown(link.name)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <button
                      className={classNames(
                        'px-3 py-2 rounded-lg text-lg font-bold transition-colors',
                        openDropdown === link.name ||
                          link.dropdown.some((item) => isActivePath(item.path))
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                          : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                      )}
                    >
                      {link.shorthand}
                    </button>
                    {openDropdown === link.name && (
                      <div className="absolute top-full left-0 pt-2 z-50">
                        <div className="bg-white rounded-lg shadow-lg border border-purple-100 py-2 min-w-[220px]">
                          {link.dropdown.map((item) => (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={classNames(
                                'block px-4 py-2 text-base font-semibold transition-colors',
                                isActivePath(item.path)
                                  ? 'bg-purple-50 text-purple-600'
                                  : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
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
                    'px-3 py-2 rounded-lg text-lg font-bold transition-colors',
                    isActivePath(link.path!)
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                  )}
                >
                  {link.shorthand}
                </Link>
              );
            })}
          </div>

          {/* User Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            {isAdmin && (
              <Link
                to="/admin/student-dashboard"
                className={classNames(
                  'px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5',
                  isActivePath('/admin/student-dashboard')
                    ? 'bg-amber-100 text-amber-700'
                    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                )}
              >
                <ShieldCheck size={16} /> Admin
              </Link>
            )}
            <Link
              to="/profile"
              className="px-3 py-2 rounded-lg text-lg font-bold text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded-lg text-lg font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center"
            >
              <LogOut size={20} className="mr-2" />
              Sign out
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500 transition-colors"
            >
              <span className="sr-only">
                {isOpen ? 'Close main menu' : 'Open main menu'}
              </span>
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-purple-100 bg-white/95 backdrop-blur-sm">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigationLinks.map((link) => {
              if (link.dropdown) {
                return (
                  <div key={link.name}>
                    <div className="px-3 py-2 text-sm font-semibold text-gray-500 uppercase">
                      {link.name}
                    </div>
                    {link.dropdown.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={classNames(
                          'block px-6 py-2 rounded-lg text-base font-semibold transition-colors',
                          isActivePath(item.path)
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                            : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
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
                    'block px-3 py-2 rounded-lg text-lg font-bold transition-colors',
                    isActivePath(link.path!)
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {link.shorthand}
                </Link>
              );
            })}
          </div>

          <div className="pt-4 pb-3 border-t border-purple-100">
            <div className="px-2 space-y-1">
              {isAdmin && (
                <Link
                  to="/admin/student-dashboard"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <ShieldCheck size={16} /> Admin Dashboard
                </Link>
              )}
              <Link
                to="/profile"
                className="block px-3 py-2 rounded-lg text-lg font-bold text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  handleSignOut();
                  setIsOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-lg text-lg font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center"
              >
                <LogOut size={20} className="inline mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;