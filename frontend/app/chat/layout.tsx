"use client";
import { Plus, LogOut, Trash2, Folder, FolderPlus, MoreVertical, FileText, ArrowUpDown, Pencil, Sun, Moon, ChevronLeft } from 'lucide-react';
import { useTheme } from "next-themes";
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/AuthProvider';
import { auth, db } from '@/lib/firebase';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, DragEvent, MouseEvent, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { VscLoading } from 'react-icons/vsc';

// --- TYPE DEFINITIONS ---
type ChatStub = {
    id: string;
    documentName: string;
    documentTitle?: string;
    createdAt: any;
}

type Folder = {
    id: string;
    folderName: string;
    chats: ChatStub[];
}

type RenameItem = {
    id: string;
    name: string;
    type: 'chat' | 'folder';
}

// --- SORTING LOGIC ---
const sortChats = (chats: ChatStub[], order: string): ChatStub[] => {
    return [...chats].sort((a, b) => {
        switch (order) {
            case 'oldest':
                return a.createdAt?.toMillis() - b.createdAt?.toMillis();
            case 'a-z':
                const titleA = a.documentTitle || a.documentName;
                const titleB = b.documentTitle || b.documentName;
                return titleA.localeCompare(titleB);
            case 'z-a':
                const titleC = a.documentTitle || a.documentName;
                const titleD = b.documentTitle || b.documentName;
                return titleD.localeCompare(titleC);
            case 'newest':
            default:
                return b.createdAt?.toMillis() - a.createdAt?.toMillis();
        }
    });
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
    
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { setTheme } = useTheme();
    
    const [rawFolders, setRawFolders] = useState<Folder[]>([]);
    const [rawUncategorized, setRawUncategorized] = useState<ChatStub[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState<string>('newest');

    const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameItem, setRenameItem] = useState<RenameItem | null>(null);
    const [newItemName, setNewItemName] = useState("");

    const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);

    // --- Added state to manage the sidebar's collapsed state ---
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const chatsQuery = query(collection(db, "chats"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const foldersQuery = query(collection(db, "folders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const chatFoldersQuery = query(collection(db, "chatFolders"), where("userId", "==", user.uid));

        const unsubscribeChats = onSnapshot(chatsQuery, (chatsSnapshot) => {
            const allChats = new Map(
                chatsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as ChatStub])
            );

            const unsubscribeFolders = onSnapshot(foldersQuery, (foldersSnapshot) => {
                const allFolders: Folder[] = foldersSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, folderName: data.folderName, chats: [] };
                });

                const unsubscribeMappings = onSnapshot(chatFoldersQuery, (mappingsSnapshot) => {
                    const chatFolderMap = new Map(mappingsSnapshot.docs.map(doc => [doc.data().chatId, doc.data().folderId]));
                    const chatsInFolders = new Set<string>();

                    allFolders.forEach(f => f.chats = []); 

                    for (const [chatId, folderId] of chatFolderMap.entries()) {
                        const chat = allChats.get(chatId);
                        const folder = allFolders.find(f => f.id === folderId);
                        if (chat && folder) {
                            folder.chats.push(chat);
                            chatsInFolders.add(chatId);
                        }
                    }
                    
                    setRawFolders(allFolders);
                    setRawUncategorized(Array.from(allChats.values()).filter(chat => !chatsInFolders.has(chat.id)));
                    setIsLoading(false);
                });
                return unsubscribeMappings;
            });
            return unsubscribeFolders;
        });
        return () => unsubscribeChats();
    }, [user]);

    const { sortedFolders, sortedUncategorized } = useMemo(() => {
        const sortedFolders = rawFolders.map(folder => ({
            ...folder,
            chats: sortChats(folder.chats, sortOrder)
        }));
        const sortedUncategorized = sortChats(rawUncategorized, sortOrder);
        return { sortedFolders, sortedUncategorized };
    }, [rawFolders, rawUncategorized, sortOrder]);

    const handleCreateFolder = async () => {
        if (!newFolderName || !user) return;
        setIsNewFolderModalOpen(false);
        setNewFolderName("");

        const token = await user.getIdToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        try {
            await fetch(`${apiUrl}/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ folder_name: newFolderName })
            });
        } catch (error) {
            console.error("Failed to create folder:", error);
        }
    };

    const handleMoveChat = async (chatId: string, folderId: string | null) => {
        if (!user) return;
        const token = await user.getIdToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        try {
             await fetch(`${apiUrl}/move-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ chat_id: chatId, folder_id: folderId })
            });
        } catch (error) {
            console.error("Failed to move chat:", error);
        }
    };

    const handleDelete = async (chatIdToDelete: string) => {
        if (!user || !window.confirm("Are you sure?")) return;
        try {
            const token = await user.getIdToken();
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            await fetch(`${apiUrl}/chats/${chatIdToDelete}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            
            if (params.chatId === chatIdToDelete) {
                router.push('/chat');
            }
        } catch (error) {
            console.error("Failed to delete chat:", error);
            alert("Could not delete chat.");
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!user || !window.confirm("Are you sure? Chats in this folder will become uncategorized.")) return;
        try {
            const token = await user.getIdToken();
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            await fetch(`${apiUrl}/folders/${folderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
        } catch (error) {
            console.error("Failed to delete folder:", error);
            alert("Could not delete folder.");
        }
    };

    const openRenameModal = (item: RenameItem) => {
        setRenameItem(item);
        setNewItemName(item.name);
        setIsRenameModalOpen(true);
    };

    const handleRename = async () => {
        if (!newItemName || !renameItem || !user) return;

        const { id, type } = renameItem;
        const endpoint = type === 'chat' ? `/chats/${id}` : `/folders/${id}`;
        const body = type === 'chat' 
            ? { document_title: newItemName } 
            : { folder_name: newItemName };

        setIsRenameModalOpen(false);
        setRenameItem(null);
        setNewItemName("");

        const token = await user.getIdToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        try {
            await fetch(`${apiUrl}${endpoint}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
        } catch (error) {
            console.error(`Failed to rename ${type}:`, error);
        }
    };

    const handleLogout = async () => {
        await auth.signOut();
        router.push('/login');
    };

    const handleDragStart = (chatId: string) => setDraggedChatId(chatId);
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (folderId: string | null) => {
        if (draggedChatId) {
            handleMoveChat(draggedChatId, folderId);
        }
        setDraggedChatId(null);
        setDropTargetId(null);
    };
    
    if (!user || isLoading) return <div className="flex h-screen items-center justify-center"><VscLoading className="animate-spin text-4xl" /></div>;

    return (
        <>
            <Dialog open={isNewFolderModalOpen} onOpenChange={setIsNewFolderModalOpen}>
                <DialogContent className="dark:bg-gray-800">
                    <DialogHeader><DialogTitle>Create New Folder</DialogTitle></DialogHeader>
                    <Input 
                        placeholder="Folder name..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button onClick={handleCreateFolder}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
                <DialogContent className="dark:bg-gray-800">
                    <DialogHeader><DialogTitle>Rename {renameItem?.type}</DialogTitle></DialogHeader>
                    <Input 
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button onClick={handleRename}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
                {/* --- Sidebar width and contents are now conditional --- */}
                <aside className={`bg-gray-800 text-white p-4 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
                    
                    {/* --- Xnetic AI Title and Collapse Button --- */}
                    <div className="flex items-center justify-between mb-2">
                        {!isSidebarCollapsed && (
                            <h1 className="text-xl font-bold text-white transition-opacity duration-200">Xnetic AI</h1>
                        )}
                        <Button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} variant="ghost" size="icon" title="Minimize sidebar">
                            <ChevronLeft className={`h-5 w-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>

                    <div className={`flex items-center justify-between mb-4 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <Link href="/chat" passHref>
                            <Button className={`justify-start bg-transparent hover:bg-gray-700 ${isSidebarCollapsed ? 'w-full justify-center' : 'flex-grow'}`}>
                                <Plus className="h-4 w-4" />
                                {!isSidebarCollapsed && <span className="ml-2">New Chat</span>}
                            </Button>
                        </Link>
                        {!isSidebarCollapsed && (
                            <Button onClick={() => setIsNewFolderModalOpen(true)} variant="ghost" size="icon" title="Create new folder">
                                <FolderPlus className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    
                    {/* --- Main chat/folder list, hidden when collapsed --- */}
                    <div className={`flex-grow overflow-y-auto transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex items-center justify-between px-2 mb-2">
                            <p className="text-xs font-semibold uppercase text-gray-400">Chats</p>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-gray-400 hover:bg-gray-700 hover:text-white">
                                        <ArrowUpDown className="h-3 w-3 mr-1" /> Sort
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setSortOrder('newest')}>Newest First</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setSortOrder('oldest')}>Oldest First</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setSortOrder('a-z')}>A-Z</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setSortOrder('z-a')}>Z-A</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {sortedFolders.map(folder => (
                            <details key={folder.id} open>
                                <summary 
                                    className={`flex items-center p-2 rounded-md cursor-pointer hover:bg-gray-700 list-none transition-colors group ${dropTargetId === folder.id ? 'bg-gray-600' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragEnter={() => setDropTargetId(folder.id)}
                                    onDragLeave={() => setDropTargetId(null)}
                                    onDrop={() => handleDrop(folder.id)}
                                >
                                    <Folder className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="flex-grow truncate font-medium text-sm">{folder.folderName}</span>
                                    <FolderActions folder={folder} onRename={openRenameModal} onDelete={handleDeleteFolder} />
                                </summary>
                                <div className="pl-4 space-y-1 py-1">
                                    {folder.chats.map(chat => <ChatItem key={chat.id} chat={chat} onDragStart={handleDragStart} onDelete={handleDelete} onRename={openRenameModal} />)}
                                </div>
                            </details>
                        ))}
                        
                        {sortedUncategorized.length > 0 && (
                            <details open className="mt-4">
                                <summary 
                                    className={`flex items-center p-2 rounded-md cursor-pointer hover:bg-gray-700 list-none transition-colors ${dropTargetId === null ? 'bg-gray-600' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragEnter={() => setDropTargetId(null)}
                                    onDragLeave={() => setDropTargetId(null)}
                                    onDrop={() => handleDrop(null)}
                                >
                                    <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="flex-grow truncate font-medium text-sm">Uncategorized</span>
                                </summary>
                                <div className="pl-4 space-y-1 py-1">
                                    {sortedUncategorized.map(chat => <ChatItem key={chat.id} chat={chat} onDragStart={handleDragStart} onDelete={handleDelete} onRename={openRenameModal} />)}
                                </div>
                            </details>
                        )}
                    </div>

                    {/* --- Sidebar Footer --- */}
                    <div className="border-t border-gray-700 pt-2 flex items-center justify-between">
                        <Button onClick={handleLogout} className={`justify-start bg-transparent hover:bg-gray-700 ${isSidebarCollapsed ? 'w-full justify-center' : 'flex-grow'}`}>
                            <LogOut className="h-4 w-4" />
                            {!isSidebarCollapsed && <span className="ml-2">Logout</span>}
                        </Button>
                        <div className="flex">
                            {!isSidebarCollapsed && (
                                <>
                                    <Button onClick={() => setTheme("light")} variant="ghost" size="icon" className="h-8 w-8" title="Switch to Light Mode">
                                        <Sun className="h-4 w-4" />
                                    </Button>
                                    <Button onClick={() => setTheme("dark")} variant="ghost" size="icon" className="h-8 w-8" title="Switch to Dark Mode">
                                        <Moon className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </aside>
                <main className="flex-1 bg-white dark:bg-black">
                    {children}
                </main>
            </div>
        </>
    );
}

function FolderActions({ folder, onRename, onDelete }: { folder: Folder, onRename: (item: RenameItem) => void, onDelete: (folderId: string) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename({id: folder.id, name: folder.folderName, type: 'folder'})}}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(folder.id)}} className="text-red-500">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function ChatItem({ chat, onDragStart, onDelete, onRename }: { 
    chat: ChatStub, 
    onDragStart: (chatId: string) => void, 
    onDelete: (chatId: string) => void,
    onRename: (item: RenameItem) => void 
}) {
    const displayName = chat.documentTitle || chat.documentName;
    return (
        <div 
            draggable={true}
            onDragStart={() => onDragStart(chat.id)}
            className="w-full justify-between text-white/80 hover:bg-gray-700/50 group flex items-center rounded-md text-sm cursor-grab"
        >
            <Link href={`/chat/${chat.id}`} className="flex-grow truncate p-2" title={chat.documentName}>
                {displayName}
            </Link>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onRename({id: chat.id, name: displayName, type: 'chat'})}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(chat.id)} className="text-red-500">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}