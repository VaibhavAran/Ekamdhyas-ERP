import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Mail, 
  Hash, 
  Building2, 
  BookOpen, 
} from 'lucide-react';
import type { User as UserType } from '../types';
import { saveUser } from '../lib/firebaseService';

interface ProfileProps {
  user: UserType;
  onUpdate: (updatedUser: UserType) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdate }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [formData, setFormData] = React.useState<UserType>(user);

  React.useEffect(() => {
    setFormData(user);
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await saveUser(formData);
    } catch (error) {
      console.error('Error saving profile to Firestore:', error);
    }

    // Do not persist profile via localStorage; rely on Firestore + auth
    onUpdate(formData);
    setIsEditing(false);
  };

  const profileDisplayFields = [
    { name: 'name', icon: UserIcon, label: 'Full Name', value: user.name },
    { name: 'rollNumber', icon: Hash, label: 'Roll Number', value: user.rollNumber },
    { name: 'department', icon: Building2, label: 'Department', value: user.department },
    { name: 'class', icon: BookOpen, label: 'Class/Division', value: user.class },
    { name: 'email', icon: Mail, label: 'Email Address', value: user.email },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Profile</h1>
        <p className="text-gray-500 mt-1">Manage your personal information and academic identity.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 border border-gray-100 bg-white rounded-3xl p-8 flex flex-col items-center h-fit">
          <div className="relative group">
            <div className="h-32 w-32 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 p-1">
              <div className="h-full w-full rounded-full bg-white p-1">
                <div className="h-full w-full rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  <UserIcon className="h-16 w-16 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 mt-6">{user.name}</h2>
          <p className="text-sm text-gray-500 font-medium">{user.rollNumber}</p>
          
          

          <div className="mt-8 pt-8 border-t border-gray-100 w-full text-center">
            <div className="flex justify-around">
              
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Academic & Personal Details</h2>
            {isEditing && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">Editing Mode</span>}
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <AnimatePresence mode="wait">
              {profileDisplayFields.map((field, idx) => (
                <motion.div 
                  key={field.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <field.icon className="h-3.5 w-3.5" />
                    {field.label}
                  </p>
                  
                  {isEditing && field.name !== 'role' ? (
                    <input
                      name={field.name}
                      value={(formData as any)[field.name]}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-blue-50/50 border-2 border-blue-100 focus:border-blue-500 rounded-xl outline-none transition-all text-sm font-semibold text-gray-900"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 border border-transparent rounded-xl">
                      <p className="text-sm font-semibold text-gray-900">{field.value}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
