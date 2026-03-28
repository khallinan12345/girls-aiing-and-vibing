// src/components/profile/ProfileCompletionPopup.tsx

import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { User, GraduationCap, Globe, School, MapPin } from 'lucide-react';

interface ProfileCompletionPopupProps {
  userId: string;
  email: string;
  onComplete: () => void;
}

interface ProfileFormData {
  name: string;
  role: 'student' | 'teacher';
  grade_level: string;
  gender: 'female' | 'male' | 'other';
  continent: string;
  country: string;
  state: string;
  city: string;
  school_name: string;
}

// All continents except Antarctica
const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America'
];

// Full list of countries (unchanged from your original)
// Paste your existing COUNTRIES array here:
const COUNTRIES = [
  'United States',
  'Nigeria',
  'Kenya',

  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Aruba',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Costa Rica',
  'Côte d’Ivoire',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Federated States of Micronesia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Republic of the Congo',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
];


const ProfileCompletionPopup: React.FC<ProfileCompletionPopupProps> = ({
  userId,
  email,
  onComplete,
}) => {
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    role: 'student',
    grade_level: '3',
    gender: 'female',
    continent: '',
    country: '',
    state: '',
    city: '',
    school_name: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (formData.role === 'student' && !formData.grade_level) {
      setError('Please select your grade level');
      return;
    }
    if (!formData.continent) {
      setError('Please select your continent');
      return;
    }
    if (!formData.country) {
      setError('Please select your country');
      return;
    }

    setIsSubmitting(true);

    try {
      // Verify session & user
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('No active session');
      }
      const actualUserId = session.user.id;
      const actualEmail = session.user.email;

      // Build profile payload (include continent) :contentReference[oaicite:0]{index=0}
      const profileData = {
        id: actualUserId,
        email: actualEmail || email,
        name: formData.name,
        role: formData.role,
        grade_level:
          formData.role === 'student'
            ? parseInt(formData.grade_level, 10)
            : null,
        gender: formData.gender,
        continent: formData.continent,     // ← NEW
        country: formData.country,
        state: formData.state || null,
        city: formData.city || null,
        school_name: formData.school_name || null,
        profile_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Upsert into profiles
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', actualUserId)
        .maybeSingle();
      if (checkError) throw checkError;

      if (existing) {
        await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', actualUserId);
      } else {
        await supabase.from('profiles').insert(profileData);
      }

      // Seed dashboard activities for students by continent
      if (formData.role === 'student') {
        const continentParam = formData.continent;
        console.log(
          `[ProfileCompletionPopup] 🎓 Seeding dashboard for continent=${continentParam}`
        );

        // 1) Try RPC: create_grade_appropriate_dashboard_activities_by_continent
        const { error: rpcError } = await supabase.rpc(
          'create_grade_appropriate_dashboard_activities_by_continent',
          {
            user_id_param: actualUserId,
            continent_param: continentParam,
          }
        );

        if (rpcError) {
          console.warn(
            '[ProfileCompletionPopup] ⚠️ Continent RPC failed, falling back…',
            rpcError
          );

          // 2) Fallback: fetch modules by continent directly :contentReference[oaicite:1]{index=1}
          const userGrade = parseInt(formData.grade_level, 10);
         
          const { data: modules, error: moduleError } = await supabase
            .from('learning_modules')
            .select('learning_module_id, title, category, grade_level')
            .eq('continent', continentParam)
            .eq('public', 1)
            .in('grade_level', [userGrade, 4])   // ← pulls both the student’s grade and grade 4
            .limit(10);

          if (moduleError) {
            console.warn(
              '[ProfileCompletionPopup] ⚠️ Module fetch error:',
              moduleError
            );
          } else if (modules && modules.length > 0) {
            const dashboardActivities = modules.map((mod) => ({
              user_id: actualUserId,
              learning_module_id: mod.learning_module_id,
              status: 'not_started',
              progress: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));
            const { error: insertError } = await supabase
            .from('dashboard')          // ← use your real table name
            .insert(dashboardActivities);
            if (insertError) {
              console.warn(
                '[ProfileCompletionPopup] ⚠️ Dashboard insert error:',
                insertError
              );
            } else {
              console.log(
                `[ProfileCompletionPopup] ✅ Created ${dashboardActivities.length} activities for ${continentParam}`
              );
            }
          } else {
            console.log(
              '[ProfileCompletionPopup] ℹ️ No modules found for',
              continentParam
            );
          }
        } else {
          console.log(
            `[ProfileCompletionPopup] ✅ RPC seeded activities for ${continentParam}`
          );
        }
      }

      // Done!
      onComplete();
    } catch (err: any) {
      console.error('[ProfileCompletionPopup] 💥 Error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-6">
            <div className="p-3 bg-blue-100 rounded-full mr-4">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Complete Your Profile
              </h2>
              <p className="text-sm text-gray-600">
                Help us personalize your learning experience
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  handleInputChange('name', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <GraduationCap className="inline mr-1" />
                I am a: *
              </label>
              <div className="space-y-2">
                {(['student', 'teacher'] as const).map((r) => (
                  <label key={r} className="flex items-center">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={formData.role === r}
                      onChange={(e) =>
                        handleInputChange(
                          'role',
                          e.target.value as any
                        )
                      }
                      className="mr-3"
                    />
                    <span>
                      {r === 'student'
                        ? 'Student'
                        : 'Teacher/Educator'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

          
            {/* Grade Level (students only) */}
            {formData.role === 'student' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grade Level *
                </label>
                <div className="space-y-2">
                  {(['1', '2', '3'] as const).map((g) => (
                    <label key={g} className="flex items-start">
                      <input
                        type="radio"
                        name="grade_level"
                        value={g}
                        checked={formData.grade_level === g}
                        onChange={(e) =>
                          handleInputChange('grade_level', e.target.value)
                        }
                        className="mr-3 mt-1"
                        required
                      />
                      <div>
                        <div className="font-medium text-gray-900">
                          {g === '1'
                            ? 'Elementary (Grades 3–5)'
                            : g === '2'
                            ? 'Middle School (Grades 6–8)'
                            : 'High School (Grades 9–12)'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {g === '1'
                            ? 'Ages 8–11'
                            : g === '2'
                            ? 'Ages 11–14'
                            : 'Ages 14–18'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}


            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender *
              </label>
              <div className="space-y-2">
                {(['female', 'male', 'other'] as const).map((g) => (
                  <label key={g} className="flex items-center">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={formData.gender === g}
                      onChange={(e) =>
                        handleInputChange('gender', e.target.value)
                      }
                      className="mr-3"
                      required
                    />
                    <span className="capitalize">{g}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Continent */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Continent *
              </label>
              <select
                value={formData.continent}
                onChange={(e) =>
                  handleInputChange('continent', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Select a continent</option>
                {CONTINENTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="inline mr-1" />
                Country *
              </label>
              <select
                value={formData.country}
                onChange={(e) =>
                  handleInputChange('country', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Select a country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* State */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline mr-1 text-blue-600" />
                State/Province
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) =>
                  handleInputChange('state', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Optional"
              />
            </div>

            {/* City */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline mr-1 text-green-600" />
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) =>
                  handleInputChange('city', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Optional"
              />
            </div>

            {/* School */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <School className="inline mr-1" />
                School/Organization (Optional)
              </label>
              <input
                type="text"
                value={formData.school_name}
                onChange={(e) =>
                  handleInputChange('school_name', e.target.value)
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Optional"
              />
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Completing...' : 'Complete Profile'}
              </button>
            </div>
          </form>

          <div className="mt-4 text-xs text-gray-500 text-center">
            Signed in as: {email}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionPopup;