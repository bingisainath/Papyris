
// src/components/organisms/Sidebar.tsx
import React, { useEffect, useState, Suspense, lazy } from 'react';
import { IoChatbubbleEllipses } from 'react-icons/io5';
import { FaUserPlus } from 'react-icons/fa';
import { HiUserGroup } from 'react-icons/hi2';
import { BiLogOut } from 'react-icons/bi';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../atoms/Avatar';
import Loading from '../../atoms/Loading';
import ChatList from '../ChatList';
// import { logout } from '../../redux/userSlice';

// const EditUserDetails = lazy(() => import('../EditUserDetails'));
// const SearchUser = lazy(() => import('../SearchUser'));

const Sidebar: React.FC = () => {
  const user = useSelector((state: any) => state?.user);
  const socketConnection = useSelector((state: any) => state?.user?.socketConnection);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [openSearchUser, setOpenSearchUser] = useState(false);
  const [active, setActive] = useState<'chat' | 'groupChat'>('chat');
  const [allUser, setAllUser] = useState([]);
  const [allGroups, setAllGroups] = useState([]);

  useEffect(() => {
    if (socketConnection) {
      socketConnection.emit('sidebar', user._id);

      socketConnection.on('conversation', (data: any) => {
        const individualConversations = data.individual || [];
        const groupConversations = data.groups || [];

        const conversationUserData = individualConversations.map((conv: any) => {
          if (conv?.sender?._id === conv?.receiver?._id) {
            return { ...conv, userDetails: conv?.sender };
          } else if (conv?.receiver?._id !== user?._id) {
            return { ...conv, userDetails: conv.receiver };
          } else {
            return { ...conv, userDetails: conv.sender };
          }
        });

        setAllUser(conversationUserData);
        setAllGroups(groupConversations);
      });

      return () => {
        socketConnection.off('conversation');
      };
    }
  }, [socketConnection, user, active]);

  const handleLogout = () => {
    // dispatch(logout());
    navigate('/login');
    localStorage.clear();
  };

  return (
    <div className="w-full h-full grid grid-cols-[58px,1fr] bg-white">
      {/* Navigation Bar */}
      <div className="bg-slate-100 w-14 h-full py-5 flex flex-col justify-between border-r">
        <div>
          <button
            onClick={() => {
              setActive('chat');
              navigate('/home');
            }}
            className={`w-12 h-12 mx-1 mb-2 flex justify-center items-center cursor-pointer hover:bg-slate-200 rounded transition ${
              active === 'chat' && 'bg-primary text-white'
            }`}
            title="Chats"
          >
            <IoChatbubbleEllipses size={20} />
          </button>

          <button
            onClick={() => {
              setActive('groupChat');
              navigate('/home');
            }}
            className={`w-12 h-12 mx-1 mb-2 flex justify-center items-center cursor-pointer hover:bg-slate-200 rounded transition ${
              active === 'groupChat' && 'bg-primary text-white'
            }`}
            title="Groups"
          >
            <HiUserGroup size={20} />
          </button>

          <button
            title="Add friend"
            onClick={() => setOpenSearchUser(true)}
            className="w-12 h-12 mx-1 flex justify-center items-center cursor-pointer hover:bg-slate-200 rounded transition"
          >
            <FaUserPlus size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <button
            title={user?.name}
            onClick={() => setEditUserOpen(true)}
            className="mb-3"
          >
            <Avatar
              width={35}
              height={35}
              name={user?.name}
              imageUrl={user?.profile_pic}
              userId={user?._id}
            />
          </button>

          <button
            title="Logout"
            className="w-12 h-12 flex justify-center items-center cursor-pointer hover:bg-slate-200 rounded transition"
            onClick={handleLogout}
          >
            <BiLogOut size={20} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-full">
            <Loading />
          </div>
        }
      >
        <ChatList
          chats={active === 'chat' ? allUser : allGroups}
          type={active}
          onCreateGroup={() => console.log('Create group')}
        />
      </Suspense>

      {/* Modals */}
      {/* {editUserOpen && (
        <Suspense fallback={<Loading />}>
          <EditUserDetails onClose={() => setEditUserOpen(false)} user={user} />
        </Suspense>
      )}

      {openSearchUser && (
        <Suspense fallback={<Loading />}>
          <SearchUser onClose={() => setOpenSearchUser(false)} onCall={() => {}} />
        </Suspense>
      )} */}
    </div>
  );
};

export default Sidebar;