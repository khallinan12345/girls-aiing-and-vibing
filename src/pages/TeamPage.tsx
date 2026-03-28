// src/pages/TeamPage.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import AppLayout from '../components/layout/AppLayout';


const availableRoles = [
  'Team Captain',
  'Tech Director',
  'Story & Strategy Director',
  'Creative Director',
  'Research Captain',
  'Finance Lead',
  'UX Designer',
  'AI Facilitator',
  'Testing & Quality Director',
  'Community Captain',
  'Innovation Strategist',
  'Ethics & Impact Officer'
];

function generateTeamCode(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const TeamPage = () => {
  const { user } = useAuth();
  const [userTeams, setUserTeams] = useState([]);
  const [mode, setMode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [roles, setRoles] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [teamCodeCreated, setTeamCodeCreated] = useState('');
  const [selectedTeamForSession, setSelectedTeamForSession] = useState(null);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingRoles, setEditingRoles] = useState([]);

  useEffect(() => {
    if (user?.id) fetchUserTeams();
  }, [user]);

  const fetchUserTeams = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        team_id,
        roles,
        teams (
          id,
          name,
          team_code,
          team_members (
            user_id,
            roles,
            profiles ( name, email )
          )
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error("❌ Error fetching user teams:", error);
    } else {
      console.log("✅ Fetched full user teams:", data);
      setUserTeams(data);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName || roles.length === 0) {
      alert('Team name and roles are required');
      return;
    }
    const teamCode = generateTeamCode();
    const { data: newTeam, error: teamError } = await supabase
      .from('teams')
      .insert([{ name: teamName, created_by: user.id, team_code: teamCode }])
      .select()
      .single();
    if (teamError || !newTeam) {
      console.error('❌ Error creating team:', teamError);
      alert('Error creating team');
      return;
    }
    const { error: memberError } = await supabase.from('team_members').insert({
      user_id: user.id,
      team_id: newTeam.id,
      roles,
    });
    if (memberError) {
      console.error('❌ Error adding user to team_members:', memberError);
      alert('Team was created, but adding you as a member failed.');
      return;
    }
    setTeamCodeCreated(teamCode);
    setTeamName('');
    setRoles([]);
    fetchUserTeams();
  };

  const handleJoinTeam = async () => {
    if (!joinCode || roles.length === 0) return alert('Team code and roles are required');
    const { data: team, error } = await supabase
      .from('teams')
      .select('id')
      .eq('team_code', joinCode.toUpperCase())
      .single();
    if (error || !team) return alert('Team not found');
    await supabase.from('team_members').insert({ user_id: user.id, team_id: team.id, roles });
    setJoinCode('');
    setRoles([]);
    fetchUserTeams();
  };

  const handleEdit = (team) => {
    setEditingTeamId(team.team_id);
    setEditingTeamName(team.teams.name);
    setEditingRoles(team.roles || []);
  };

  const saveEdit = async (teamId) => {
    const updateTeam = supabase.from('teams').update({ name: editingTeamName }).eq('id', teamId);
    const updateMember = supabase
      .from('team_members')
      .update({ roles: editingRoles })
      .eq('user_id', user.id)
      .eq('team_id', teamId);
    await Promise.all([updateTeam, updateMember]);
    setEditingTeamId(null);
    fetchUserTeams();
  };

  const handleDelete = async (teamId) => {
    await supabase.from('team_members').delete().eq('user_id', user.id).eq('team_id', teamId);
    fetchUserTeams();
  };

  return (
    <AppLayout>
    {/* Background image layer */}
    <div
      className="absolute inset-0 bg-[url('/girls_teaming.png')] bg-cover bg-center bg-fixed opacity-80 z-0"
      aria-hidden="true"
      />
      <div className="relative z-10 max-w-3xl mx-auto p-6 bg-white bg-opacity-90 rounded shadow">
        <h1 className="text-2xl font-bold mb-2">Join or Create a Team</h1>
        <p className="text-sm text-gray-600 mb-6">
          Either create a new team, join an existing team (given a team code id shared by a peer student or your teacher), or participate in a learning or project session as a team member.<br /><br />
          If creating a new team, you just simply have to provide a team name and define the roles you anticipate having in a team. You can change this later.<br /><br />
          If joining an existing team, all you need is a 5 digit code provided to you by a team member or your teacher. You will then be asked to define the role or roles you want in the team. You can edit this later.<br /><br />
          If simply wanting to participate in a session as a team member - where you and your team members will be working together with an AI assistant - select the team you want to participate with.
        </p>
  
        <div className="mb-6">
          <label className="block font-medium mb-2">Select Action</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="">-- Choose --</option>
            <option value="create">Create a New Team</option>
            <option value="join">Join an Existing Team</option>
          </select>
        </div>
  
        {mode === 'create' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full border p-2 rounded"
            />
            <label className="block font-medium">Select Your Role(s):</label>
            <select
              multiple
              value={roles}
              onChange={(e) =>
                setRoles(Array.from(e.target.selectedOptions, (opt) => opt.value))
              }
              className="w-full border p-2 rounded h-32"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <button onClick={handleCreateTeam} className="bg-green-600 text-white px-4 py-2 rounded">
              Create Team
            </button>
            {teamCodeCreated && (
              <p className="mt-2 text-blue-700">
                Team created! Share this code with teammates: <strong>{teamCodeCreated}</strong>
              </p>
            )}
          </div>
        )}
  
        {mode === 'join' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter team code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full border p-2 rounded"
            />
            <label className="block font-medium">Select Your Role(s):</label>
            <select
              multiple
              value={roles}
              onChange={(e) =>
                setRoles(Array.from(e.target.selectedOptions, (opt) => opt.value))
              }
              className="w-full border p-2 rounded h-32"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <button onClick={handleJoinTeam} className="bg-blue-600 text-white px-4 py-2 rounded">
              Join Team
            </button>
          </div>
        )}
  
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Your Teams</h2>
          {userTeams.length === 0 ? (
            <p className="text-gray-600">You are not in any teams yet.</p>
          ) : (
            userTeams.map((tm) => (
              <div key={tm.team_id} className="border p-4 rounded mb-4 bg-white">
                <div className="flex justify-between items-center">
                  <h3 className="text-md font-bold">
                    {tm.teams.name}{' '}
                    <span className="text-sm font-normal text-gray-500">
                      Code: {tm.teams.team_code}
                    </span>
                  </h3>
                  <button onClick={() => handleEdit(tm)} className="text-sm text-blue-600">✏️</button>
                </div>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-left text-gray-700 border-b">
                      <th className="py-1">Team Members</th>
                      <th className="py-1">Roles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tm.teams.team_members.map((member) => (
                      <tr key={member.user_id} className="border-b">
                        <td className="py-1">
                          {member.user_id === user.id ? 'You' : member.profiles?.name || member.profiles?.email || 'Unnamed'}
                        </td>
                        <td className="py-1">{member.roles?.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editingTeamId === tm.team_id && (
                  <div className="mt-4 space-y-2">
                    <input
                      type="text"
                      value={editingTeamName}
                      onChange={(e) => setEditingTeamName(e.target.value)}
                      className="w-full border p-2 rounded"
                    />
                    <select
                      multiple
                      value={editingRoles}
                      onChange={(e) =>
                        setEditingRoles(Array.from(e.target.selectedOptions, (opt) => opt.value))
                      }
                      className="w-full border p-2 rounded h-32"
                    >
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(tm.team_id)}
                        className="bg-blue-500 text-white px-3 py-1 rounded"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingTeamId(null)}
                        className="bg-gray-400 text-white px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(tm.team_id)}
                        className="bg-red-600 text-white px-3 py-1 rounded ml-auto"
                      >
                        Leave Team
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );  
};

export default TeamPage;