// Handles all post-related functionality
class PostManager {
    constructor() {
        this.STUDENT_ID = 'M00913254';
        this.posts = [];
        this.currentUser = null;
        this.initializeEventListeners();
        this.displayPosts();
    }

    initializeEventListeners() {
        // Create post input click handler
        const createPostInput = document.querySelector('.create-post input');
        createPostInput?.addEventListener('click', () => this.showCreatePostModal());

        // Post interactions using event delegation
        document.querySelector('.content-feed')?.addEventListener('click', async (e) => {
            const post = e.target.closest('.post');
            if (!post) return;  // Only check for post

            const postId = post.dataset.postId;

            if (e.target.closest('.vote-up')) {
                console.log('Upvote clicked');
                await this.handleVote(postId, 'up');
            } else if (e.target.closest('.vote-down')) {
                console.log('Downvote clicked');
                await this.handleVote(postId, 'down');
            } else if (e.target.closest('.comment-btn')) {
                this.toggleComments(postId);
            } else if (e.target.closest('.share-btn')) {
                this.handleShare(postId);
            } else if (e.target.closest('.save-btn')) {
                await this.handleSave(postId);
            } else if (e.target.closest('.delete-btn')) {
                await this.handleDeletePost(postId);
            }

            // Handle comment deletion separately
            const comment = e.target.closest('.comment');
            if (comment && e.target.closest('.delete-comment-btn')) {
                const commentId = e.target.dataset.commentId;
                if (confirm('Are you sure you want to delete this comment?')) {
                    await this.handleDeleteComment(postId, commentId);
                }
            }
        });

        // Comment submission handler
        document.querySelector('.content-feed')?.addEventListener('click', async (e) => {
            if (!e.target.classList.contains('submit-comment')) return;

            const post = e.target.closest('.post');
            if (!post) return;

            const postId = post.dataset.postId;
            const commentInput = post.querySelector('.comment-input');
            if (!commentInput) return;

            await this.handleComment(postId, commentInput.value);
            commentInput.value = ''; // Clear input after submission
        });

        // Modal handling
        document.addEventListener('click', (e) => {
            // Create post input click
            if (e.target.closest('.create-post input')) {
                this.showCreatePostModal();
            }

            // Close modal on close button click
            if (e.target.classList.contains('close-button') ||
                e.target.closest('.close-button')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                    // Reset form if it exists
                    const form = modal.querySelector('form');
                    if (form) form.reset();
                }
            }

            // Close modal on outside click
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });

        // Create post form submission
        const createPostForm = document.getElementById('createPostForm');
        if (createPostForm) {
            createPostForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreatePost();
            });
        }
    }

    showCreatePostModal() {
        const modal = document.getElementById('createPostModal');
        if (modal) {
            // Reset form and errors
            const form = document.getElementById('createPostForm');
            const errorElement = document.getElementById('postError');
            if (form) form.reset();
            if (errorElement) errorElement.textContent = '';
            modal.classList.add('show');
        }
    }

    async handleCreatePost() {
        const titleInput = document.getElementById('postTitle');
        const contentInput = document.getElementById('postContent');
        const communityInput = document.getElementById('postCommunity');
        const imageInput = document.getElementById('postImage');
        const errorElement = document.getElementById('postError');

        try {
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            const community = communityInput.value;

            // Handle image upload first if there's an image
            let imageUrl = null;
            if (imageInput.files && imageInput.files[0]) {
                const formData = new FormData();
                formData.append('image', imageInput.files[0]);

                const uploadResponse = await fetch(`http://localhost:8080/${this.STUDENT_ID}/upload`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload image');
                }

                const uploadData = await uploadResponse.json();
                imageUrl = uploadData.imageUrl;
            }

            // Create the post
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/contents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    content,
                    community,
                    imageUrl
                }),
                credentials: 'include'
            });

            const data = await response.json();
            if (data.success) {
                // Reset form
                titleInput.value = '';
                contentInput.value = '';
                communityInput.value = '';
                imageInput.value = '';

                // Close modal and refresh posts
                document.getElementById('createPostModal').classList.remove('show');
                await this.displayPosts(community);
                this.showNotification('Post created successfully!');
            } else {
                errorElement.textContent = data.error || 'Failed to create post';
            }
        } catch (error) {
            console.error('Error creating post:', error);
            errorElement.textContent = 'Error creating post. Please try again.';
        }
    }

    async handleVote(postId, direction) {
        console.log('Vote initiated:', { postId, direction });
        console.log('Current user:', window.authManager?.currentUser);

        if (!window.authManager?.currentUser) {
            this.showNotification('Please log in to vote', 'error');
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/contents/${postId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    direction: direction === 'up' ? 1 : -1,
                    userId: window.authManager.currentUser.id  // Add user ID
                }),
                credentials: 'include'
            });

            console.log('Vote response status:', response.status);
            const data = await response.json();
            console.log('Vote response data:', data);

            // Find the post and update its display
            const post = document.querySelector(`[data-post-id="${postId}"]`);
            console.log('Found post element:', post);

            if (post) {
                const voteCount = post.querySelector('.vote-count');
                const upvoteBtn = post.querySelector('.vote-up');
                const downvoteBtn = post.querySelector('.vote-down');

                console.log('Current vote count element:', voteCount);
                console.log('New total votes:', data.newTotal);

                // Update vote count
                if (voteCount) {
                    voteCount.textContent = data.newTotal.toString();
                }

                // Update button states
                if (upvoteBtn) {
                    upvoteBtn.classList.toggle('voted', data.newVote === 1);
                }
                if (downvoteBtn) {
                    downvoteBtn.classList.toggle('voted', data.newVote === -1);
                }
            }

        } catch (error) {
            console.error('Vote error:', error);
            this.showNotification('Error voting on post', 'error');
        }
    }

    async handleComment(postId, content) {
        if (!content.trim()) return;

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/contents/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
                credentials: 'include'
            });

            if (response.ok) {
                await this.displayPosts();
                this.showNotification('Comment added successfully!');
            }
        } catch (error) {
            console.error('Error posting comment:', error);
            this.showNotification('Error posting comment', 'error');
        }
    }

    async handleDeletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) return;

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/contents/${postId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await this.displayPosts();
                this.showNotification('Post deleted successfully!');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showNotification('Error deleting post', 'error');
        }
    }

    async handleDeleteComment(postId, commentId) {
        try {
            const response = await fetch(
                `http://localhost:8080/${this.STUDENT_ID}/contents/${postId}/comments/${commentId}`,
                {
                    method: 'DELETE',
                    credentials: 'include'
                }
            );

            if (response.ok) {
                // Refresh the post to show updated comments
                await this.displayPosts();
                this.showNotification('Comment deleted successfully');
            } else {
                throw new Error('Failed to delete comment');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            this.showNotification('Error deleting comment', 'error');
        }
    }

    handleShare(postId) {
        const postUrl = `${window.location.origin}/${this.STUDENT_ID}/post/${postId}`;
        navigator.clipboard.writeText(postUrl)
            .then(() => this.showNotification('Post URL copied to clipboard!'))
            .catch(() => this.showNotification('Failed to copy URL', 'error'));
    }

    async handleSave(postId) {
        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/contents/${postId}/save`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                await this.displayPosts();
                this.showNotification('Post saved successfully!');
            }
        } catch (error) {
            console.error('Error saving post:', error);
            this.showNotification('Error saving post', 'error');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    toggleComments(postId) {
        const post = document.querySelector(`[data-post-id="${postId}"]`);
        const commentsSection = post.querySelector('.comments-section');
        if (commentsSection) {
            commentsSection.classList.toggle('show');
        }
    }

    async displayPosts(communityName = null) {
        try {
            let url = `http://localhost:8080/${this.STUDENT_ID}/contents`;
            if (communityName) {
                url += `?community=${communityName}`;
            }

            const response = await fetch(url, {
                credentials: 'include'
            });
            const data = await response.json();

            // Find the container for posts
            const postsContainer = document.querySelector('.community-posts') ||
                document.querySelector('.content-feed');

            if (!postsContainer) return;

            const createPostElement = document.querySelector('.create-post')?.outerHTML || '';

            if (!data.posts || data.posts.length === 0) {
                postsContainer.innerHTML = `
                    ${!communityName ? createPostElement : ''}
                    <div class="post">
                        <div class="post-content">
                            <p class="no-posts">No posts yet. Be the first to post!</p>
                        </div>
                    </div>
                `;
                return;
            }

            const postsHTML = data.posts.map(post => this.createPostHTML(post)).join('');
            postsContainer.innerHTML = !communityName ? createPostElement + postsHTML : postsHTML;
        } catch (error) {
            console.error('Error fetching posts:', error);
            this.showNotification('Error loading posts', 'error');
        }
    }

    createPostHTML(post) {
        const currentUser = window.authManager?.currentUser;
        const userVote = post.votes?.[currentUser?.id] || 0;

        return `
            <div class="post" data-post-id="${post._id}">
                <div class="post-header">
                    <div class="vote-buttons">
                        <button class="vote-up ${userVote === 1 ? 'voted' : ''}" 
                                aria-label="Upvote"
                                ${!window.authManager?.currentUser ? 'disabled' : ''}>
                            ▲
                        </button>
                        <span class="vote-count">${post.totalVotes || 0}</span>
                        <button class="vote-down ${userVote === -1 ? 'voted' : ''}" 
                                aria-label="Downvote"
                                ${!window.authManager?.currentUser ? 'disabled' : ''}>
                            ▼
                        </button>
                    </div>
                    <div class="post-content">
                        <h3 class="post-title">${post.title}</h3>
                        <div class="post-meta">
                            Posted by u/${post.author} in s/${post.community} • ${this.formatTimeAgo(post.createdAt)}
                        </div>
                        <div class="post-text">${post.content}</div>
                        ${post.imageUrl ? `
                            <div class="post-image">
                                <img src="${post.imageUrl}" alt="Post image" onerror="this.style.display='none'">
                            </div>
                        ` : ''}
                        <div class="post-actions">
                            <button class="comment-btn">
                                💬 ${post.comments?.length || 0} Comments
                            </button>
                            <button class="share-btn">
                                ↗ Share
                            </button>
                            <button class="save-btn ${post.saved ? 'saved' : ''}">
                                ⭐ ${post.saved ? 'Saved' : 'Save'}
                            </button>
                            ${window.authManager?.currentUser?.username === post.author ? `
                                <button class="delete-btn">
                                    🗑️ Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                ${this.createCommentsHTML(post.comments || [])}
            </div>
        `;
    }

    createCommentsHTML(comments) {
        if (!Array.isArray(comments)) return '';

        return `
            <div class="comments-section">
                <div class="comment-form">
                    <textarea class="comment-input" placeholder="Write a comment..."></textarea>
                    <button class="submit-comment">Comment</button>
                </div>
                <div class="comments-list">
                    ${comments.map(comment => `
                        <div class="comment">
                            <div class="comment-meta">
                                u/${comment.author} • ${this.formatTimeAgo(comment.createdAt)}
                            </div>
                            <div class="comment-content">${comment.content}</div>
                            <div class="comment-actions">
                                <button class="vote-up-comment" data-comment-id="${comment.id}">▲</button>
                                <span class="comment-vote-count">${this.calculateCommentVotes(comment.votes)}</span>
                                <button class="vote-down-comment" data-comment-id="${comment.id}">▼</button>
                                ${comment.author === window.authManager?.currentUser?.username ? `
                                <button class="delete-comment-btn" data-comment-id="${comment.id}">
                                    🗑️ Delete
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    calculateCommentVotes(votes) {
        if (!votes) return 0;
        return Object.values(votes).reduce((a, b) => a + b, 0);
    }

    formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
            }
        }
        return 'just now';
    }

    async handleImageUpload(file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to upload image');
            }

            const data = await response.json();
            if (data.success) {
                console.log('Upload successful:', data.imageUrl);
                return data.imageUrl;
            } else {
                throw new Error(data.error || 'Failed to upload image');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            this.showNotification('Error uploading image: ' + error.message, 'error');
            throw error;
        }
    }
}

// Initialize manager
document.addEventListener('DOMContentLoaded', () => {
    window.postManager = new PostManager();
});

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.STUDENT_ID = 'M00913254';
        this.initializeEventListeners();
        this.initializePasswordReset();
        this.checkLoginStatus();
    }

    initializeEventListeners() {
        // Modal triggers
        document.addEventListener('click', (e) => {
            if (e.target.matches('.login-btn')) {
                this.showModal('loginModal');
            } else if (e.target.matches('.signup-btn')) {
                this.showModal('signupModal');
            } else if (e.target.matches('.close-button') || e.target.matches('.modal')) {
                this.closeModals();
            }
        });

        // Switch between modals
        document.addEventListener('click', (e) => {
            if (e.target.matches('#switchToSignup')) {
                e.preventDefault();
                this.switchModal('loginModal', 'signupModal');
            } else if (e.target.matches('#switchToLogin')) {
                e.preventDefault();
                this.switchModal('signupModal', 'loginModal');
            }
        });

        // Form submissions
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }
    }

    initializePasswordReset() {
        // Forgot password link handler
        document.getElementById('forgotPassword')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchModal('loginModal', 'passwordResetModal');
        });

        // Password reset request form handler
        document.getElementById('passwordResetForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handlePasswordResetRequest();
        });

        // Password reset confirmation form handler
        document.getElementById('passwordResetConfirmForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handlePasswordReset();
        });

        // Check for reset token in URL on page load
        this.checkResetToken();
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorElement = document.getElementById('loginError');

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.currentUser = { username };
                this.updateUIForLoggedInUser();
                this.closeModals();
                this.showNotification('Successfully logged in!');
                await window.postManager.displayPosts(); // Refresh posts after login
            } else {
                errorElement.textContent = 'Invalid username or password';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorElement.textContent = 'Login failed. Please try again.';
        }
    }

    async handleSignup() {
        const email = document.getElementById('signupEmail').value;
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const errorElement = document.getElementById('signupError');

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                errorElement.style.color = '#00ff00';
                errorElement.textContent = 'Account created successfully! Please log in.';
                setTimeout(() => {
                    this.switchModal('signupModal', 'loginModal');
                    errorElement.textContent = '';
                }, 2000);
            } else {
                errorElement.textContent = data.error || 'Registration failed. Please try again.';
            }
        } catch (error) {
            console.error('Signup error:', error);
            errorElement.textContent = 'Registration failed. Please try again.';
        }
    }

    async handlePasswordResetRequest() {
        const email = document.getElementById('resetEmail').value;
        const errorElement = document.getElementById('resetError');

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/password-reset-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Password reset link sent to your email!');
                this.closeModals();
            } else {
                errorElement.textContent = data.error || 'Failed to send reset link';
            }
        } catch (error) {
            errorElement.textContent = 'Error requesting password reset';
        }
    }

    async handlePasswordReset() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorElement = document.getElementById('resetConfirmError');
        const token = new URLSearchParams(window.location.search).get('token');

        if (newPassword !== confirmPassword) {
            errorElement.textContent = 'Passwords do not match';
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Password successfully reset!');
                this.closeModals();
                window.history.replaceState({}, document.title, window.location.pathname);
                this.switchModal('passwordResetConfirmModal', 'loginModal');
            } else {
                errorElement.textContent = data.error || 'Failed to reset password';
            }
        } catch (error) {
            errorElement.textContent = 'Error resetting password';
        }
    }

    async handleLogout() {
        try {
            await fetch(`http://localhost:8080/${this.STUDENT_ID}/login`, {
                method: 'DELETE',
                credentials: 'include'
            });

            this.currentUser = null;
            this.showNotification('Successfully logged out!');
            window.location.reload();
        } catch (error) {
            console.error('Logout failed:', error);
            this.showNotification('Failed to logout', 'error');
        }
    }

    async checkLoginStatus() {
        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/login`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.loggedIn) {
                this.currentUser = data.user;
                this.updateUIForLoggedInUser();
            }
        } catch (error) {
            console.error('Error checking login status:', error);
        }
    }

    checkResetToken() {
        const token = new URLSearchParams(window.location.search).get('token');
        if (token) {
            this.showModal('passwordResetConfirmModal');
        }
    }

    updateUIForLoggedInUser() {
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons) {
            authButtons.innerHTML = `
            <div class="user-menu">
                <span>${this.currentUser.username}</span>
                <div class="user-dropdown">
                    <button class="profile-button">Profile</button>
                    <button class="logout-btn">Log Out</button>
                </div>
            </div>
        `;

            // Add event listeners
            document.querySelector('.logout-btn')?.addEventListener('click', () => this.handleLogout());
            document.querySelector('.profile-button')?.addEventListener('click', () => this.showProfile());
        }

        document.querySelectorAll('.create-post, .vote-buttons, .post-actions').forEach(el => {
            if (el) {
                el.style.pointerEvents = 'auto';
                el.style.opacity = '1';
            }
        });
    }

    showProfile() {
        const contentFeed = document.querySelector('.content-feed');
        if (contentFeed) {
            window.userManager.showProfilePage(this.currentUser.username);
        }
    }

    showModal(modalId) {
        this.closeModals();
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
        document.body.style.overflow = '';
    }

    switchModal(fromModalId, toModalId) {
        const fromModal = document.getElementById(fromModalId);
        const toModal = document.getElementById(toModalId);
        if (fromModal && toModal) {
            fromModal.classList.remove('show');
            toModal.classList.add('show');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize manager when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

class CommunityManager {
    constructor() {
        this.STUDENT_ID = 'M00913254';
        this.communities = [];
        this.isNavigating = false;
        this.initializeEventListeners();
        this.loadCommunities();
        this.handleInitialNavigation();
    }

    initializeEventListeners() {
        // Community navigation
        document.addEventListener('click', async (e) => {
            const subItem = e.target.closest('.sub-item');
            if (subItem) {
                e.preventDefault();
                e.stopPropagation(); // Prevent event bubbling

                // Check if this is the Browse All link
                if (subItem.classList.contains('browse-all') ||
                    subItem.classList.contains('sub-item') && subItem.textContent.trim() === 'Browse All...') {
                    await this.showAllCommunities();
                    return;
                }

                const communityName = subItem.textContent.replace('s/', '').trim();
                await this.navigateToCommunity(communityName);
            }
        });

        // Create Community button
        document.addEventListener('click', (e) => {
            if (e.target.matches('button') && e.target.textContent.trim() === 'Create Community') {
                const modal = document.getElementById('createCommunityModal');
                if (modal) {
                    const form = modal.querySelector('form');
                    const errorElement = document.getElementById('communityError');
                    if (form) form.reset();
                    if (errorElement) errorElement.textContent = '';
                    modal.classList.add('show');
                }
            }
        });

        // Join/Leave community buttons
        document.addEventListener('click', async (e) => {
            if (e.target.matches('.join-community-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const communityName = e.target.dataset.community;
                await this.joinCommunity(communityName);
            } else if (e.target.matches('.leave-community-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const communityName = e.target.dataset.community;
                await this.leaveCommunity(communityName);
            }
        });

        // Modal closing
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-button') ||
                e.target.closest('.close-button') ||
                e.target.classList.contains('modal')) {
                const modal = e.target.closest('.modal') || e.target;
                if (modal.classList.contains('modal')) {
                    modal.classList.remove('show');
                    // Reset form if exists
                    const form = modal.querySelector('form');
                    if (form) form.reset();
                }
            }
        });

        // Community form submission
        const createCommunityForm = document.getElementById('createCommunityForm');
        if (createCommunityForm) {
            createCommunityForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateCommunity();
            });
        }

        // Hash change handling
        window.addEventListener('hashchange', () => {
            this.handleInitialNavigation();
        });
    }

    async handleCreateCommunity() {
        const nameInput = document.getElementById('communityName');
        const descriptionInput = document.getElementById('communityDescription');
        const typeInputs = document.getElementsByName('communityType');
        const errorElement = document.getElementById('communityError');

        try {
            const name = nameInput.value.trim();
            const description = descriptionInput.value.trim();
            const type = Array.from(typeInputs).find(input => input.checked)?.value || 'public';

            // Enhanced validation
            if (!name) {
                errorElement.textContent = 'Community name is required';
                nameInput.focus();
                return;
            }

            if (!description) {
                errorElement.textContent = 'Description is required';
                descriptionInput.focus();
                return;
            }

            // Name format validation
            if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
                errorElement.textContent = 'Community name can only contain letters, numbers, underscores, and hyphens';
                return;
            }

            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/communities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, type }),
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                // Close modal
                const modal = document.getElementById('createCommunityModal');
                if (modal) {
                    modal.classList.remove('show');
                }

                // Clear form
                const form = document.getElementById('createCommunityForm');
                if (form) form.reset();

                // Refresh communities list
                await this.loadCommunities();

                // Navigate to new community
                await this.navigateToCommunity(name);

                this.showNotification('Community created successfully!');
            } else {
                errorElement.textContent = data.error || 'Failed to create community';
            }
        } catch (error) {
            console.error('Error creating community:', error);
            errorElement.textContent = 'Error creating community';
        }
    }

    async handleInitialNavigation() {
        const hash = window.location.hash;
        if (hash.startsWith('#s/')) {
            const communityName = hash.slice(3);
            await this.showCommunityPage(communityName);
        } else if (hash === '#browse') {
            await this.showAllCommunities();
        } else {
            await this.showHomePage();
        }
    }

    async loadCommunities() {
        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/communities`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                this.communities = data.communities;
                this.updateSidebar();
            }
        } catch (error) {
            console.error('Error loading communities:', error);
        }
    }

    updateSidebar() {
        const sidebarList = document.querySelector('.sub-list');
        if (!sidebarList) return;

        const communitiesHTML = this.communities.map(community => `
            <a href="#s/${community.name}" class="sub-item" data-community="${community.name}">
                s/${community.name}
            </a>
        `).join('');

        sidebarList.innerHTML = `
            <h2>Your Communities</h2>
            ${communitiesHTML}
            <a href="#browse" class="sub-item browse-all">Browse All...</a>
        `;
    }

    async navigateToCommunity(communityName) {
        if (this.isNavigating) return;
        this.isNavigating = true;

        try {
            window.location.hash = `s/${communityName}`;
            await this.showCommunityPage(communityName);
        } catch (error) {
            console.error('Navigation error:', error);
            this.showNotification('Error loading community', 'error');
        } finally {
            this.isNavigating = false;
        }
    }

    showHomePage() {
        const contentFeed = document.querySelector('.content-feed');
        if (contentFeed) {
            contentFeed.innerHTML = `
                <div class="create-post">
                    <input type="text" placeholder="Create Post" readonly>
                </div>
                <div class="posts-container"></div>
            `;
            window.postManager?.displayPosts();
        }
    }

    async showCommunityPage(communityName) {
        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/communities/${communityName}`, {
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                this.showNotFoundPage();
                return;
            }

            const contentFeed = document.querySelector('.content-feed');
            if (contentFeed) {
                // Clear existing content first
                contentFeed.innerHTML = '';

                // Create a single community header
                const communityHeader = document.createElement('div');
                communityHeader.className = 'community-header';
                communityHeader.innerHTML = `
                    <h1>s/${data.name}</h1>
                    <p>${data.description}</p>
                    <div class="community-actions">
                        <button class="${data.isMember ? 'leave-community-btn' : 'join-community-btn'}"
                                data-community="${data.name}">
                            ${data.isMember ? 'Leave' : 'Join'}
                        </button>
                    </div>
                `;
                contentFeed.appendChild(communityHeader);

                // Create post creation section
                const createPostSection = document.createElement('div');
                createPostSection.className = 'create-post';
                createPostSection.innerHTML = `
                    <input type="text" placeholder="Create Post" readonly>
                `;
                contentFeed.appendChild(createPostSection);

                // Create container for posts
                const postsContainer = document.createElement('div');
                postsContainer.className = 'community-posts';
                contentFeed.appendChild(postsContainer);

                // Load posts
                await window.postManager?.displayPosts(communityName);
            }
        } catch (error) {
            console.error('Error loading community:', error);
            this.showNotFoundPage();
        }
    }

    async showAllCommunities() {
        try {
            console.log('Loading all communities...'); // Debug log
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/communities`, {
                credentials: 'include'
            });

            const data = await response.json();
            console.log('Communities data:', data); // Debug log

            const contentFeed = document.querySelector('.content-feed');
            if (!contentFeed) {
                console.error('Content feed element not found');
                return;
            }

            contentFeed.innerHTML = `
                <div class="communities-list-page">
                    <h1>All Communities</h1>
                    <div class="communities-grid">
                        ${data.communities.map(community => `
                            <div class="community-card">
                                <h2>s/${community.name}</h2>
                                <p>${community.description}</p>
                                <div class="community-stats">
                                    <span>${community.members?.length || 0} members</span>
                                </div>
                                <button class="community-link" data-community="${community.name}">
                                    View Community
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            // Add event listeners to the community link buttons
            contentFeed.querySelectorAll('.community-link').forEach(button => {
                button.addEventListener('click', (e) => {
                    const communityName = e.target.dataset.community;
                    if (communityName) {
                        this.navigateToCommunity(communityName);
                    }
                });
            });

        } catch (error) {
            console.error('Error loading communities:', error);
            this.showNotification('Error loading communities', 'error');
        }
    }

    async joinCommunity(communityName) {
        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/communities/${communityName}/join`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                await this.showCommunityPage(communityName);
                this.showNotification('Successfully joined community!');
                await this.loadCommunities();
            }
        } catch (error) {
            console.error('Error joining community:', error);
            this.showNotification('Failed to join community', 'error');
        }
    }

    async leaveCommunity(communityName) {
        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/communities/${communityName}/leave`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                await this.showCommunityPage(communityName);
                this.showNotification('Successfully left community');
                await this.loadCommunities();
            }
        } catch (error) {
            console.error('Error leaving community:', error);
            this.showNotification('Failed to leave community', 'error');
        }
    }

    showNotFoundPage() {
        const contentFeed = document.querySelector('.content-feed');
        if (contentFeed) {
            contentFeed.innerHTML = `
                <div class="not-found">
                    <h1>Community Not Found</h1>
                    <p>The community you're looking for doesn't exist.</p>
                    <button onclick="window.location.hash = ''">
                        Return Home
                    </button>
                </div>
            `;
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }


}

// Initialize community manager when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.communityManager = new CommunityManager();
});

class UserManager {
    constructor() {
        this.STUDENT_ID = 'M00913254';
        this.currentTab = 'posts';
        this.profile = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.addEventListener('click', async (e) => {
            // Profile link click
            if (e.target.closest('.profile-link')) {
                e.preventDefault();
                await this.showProfilePage();
            }

            // Edit Profile button click
            if (e.target.closest('.edit-profile-btn')) {
                e.preventDefault();
                this.showEditProfileModal();
            }

            // Handle tab clicks
            if (e.target.matches('.tab-link')) {
                e.preventDefault();
                const tabName = e.target.dataset.tab;
                this.currentTab = tabName;
                await this.switchTab(tabName);
            }

            // Close modal
            if (e.target.closest('.close-button')) {
                this.closeModal();
            }
        });
    }

    closeModal() {
        const modal = document.getElementById('editProfileModal');
        if (modal) {
            modal.remove();
        }
    }

    async switchTab(tabName) {
        // Update active tab styling
        document.querySelectorAll('.tab-link').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Load tab content
        await this.loadTabContent(tabName);
    }

    async loadTabContent(tab) {
        const tabContent = document.getElementById('tab-content') ||
            document.querySelector('.profile-content-area');

        if (!tabContent) return;

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/users/activity`, {
                credentials: 'include'
            });
            const data = await response.json();

            let content = '';
            switch (tab) {
                case 'posts':
                    content = this.renderPosts(data.activity.posts);
                    break;
                case 'comments':
                    content = this.renderComments(data.activity.comments);
                    break;
                case 'communities':
                    content = this.renderCommunities(data.activity.communities);
                    break;
            }

            tabContent.innerHTML = content;
        } catch (error) {
            console.error(`Error loading ${tab}:`, error);
            tabContent.innerHTML = `<div class="error-message">Error loading ${tab}</div>`;
        }
    }

    async showProfilePage() {
        const contentFeed = document.querySelector('.content-feed');
        if (!contentFeed) return;

        try {
            const [profileResponse, activityResponse] = await Promise.all([
                fetch(`http://localhost:8080/${this.STUDENT_ID}/users/profile`, {
                    credentials: 'include'
                }),
                fetch(`http://localhost:8080/${this.STUDENT_ID}/users/activity`, {
                    credentials: 'include'
                })
            ]);

            const [profileData, activityData] = await Promise.all([
                profileResponse.json(),
                activityResponse.json()
            ]);

            if (profileData.success && activityData.success) {
                // Store profile data
                this.profile = profileData.profile;

                // Render profile page
                contentFeed.innerHTML = this.createProfileHTML(
                    profileData.profile,
                    activityData.activity
                );

                // Load initial tab content
                await this.loadTabContent(this.currentTab);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            contentFeed.innerHTML = '<div class="error">Failed to load profile</div>';
        }
    }

    createProfileHTML(profile, activity) {
        return `
            <div class="profile-container">
                <div class="profile-header">
                    <div class="profile-info">
                        <h2>${profile.username}</h2>
                        <div class="profile-meta">
                            <span>Joined ${this.formatDate(profile.createdAt)}</span>
                            <span>${profile.karma || 0} karma</span>
                        </div>
                        <div class="profile-stats">
                            <span>${profile.followersCount || 0} followers</span>
                            <span>${profile.followingCount || 0} following</span>
                        </div>
                    </div>
                    <button class="edit-profile-btn">Edit Profile</button>
                </div>

                <div class="profile-bio">
                    <p>${profile.bio || 'No bio yet'}</p>
                </div>

                <div class="profile-tabs">
                    <button class="tab-link ${this.currentTab === 'posts' ? 'active' : ''}" data-tab="posts">
                        Posts (${activity.posts?.length || 0})
                    </button>
                    <button class="tab-link ${this.currentTab === 'comments' ? 'active' : ''}" data-tab="comments">
                        Comments (${activity.comments?.length || 0})
                    </button>
                    <button class="tab-link ${this.currentTab === 'communities' ? 'active' : ''}" data-tab="communities">
                        Communities (${activity.communities?.length || 0})
                    </button>
                </div>

                <div class="profile-content-area">
                    <!-- Content will be loaded dynamically -->
                </div>
            </div>
        `;
    }

    showEditProfileModal() {
        const modalHTML = `
            <div id="editProfileModal" class="modal show">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Edit Profile</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <form id="editProfileForm">
                        <div class="form-group">
                            <label for="bio">Bio</label>
                            <textarea id="bio" class="bio-textarea" placeholder="Tell us about yourself...">${this.profile?.bio || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Email Preferences</label>
                            <div class="checkbox-group">
                                <input type="checkbox" id="emailNotifications" ${this.profile?.emailPreferences?.notifications ? 'checked' : ''}>
                                <label for="emailNotifications">Receive email notifications</label>
                            </div>
                        </div>
                        <div id="profileError" class="form-error"></div>
                        <button type="submit" class="auth-button">Save Changes</button>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.initializeEditProfileForm();
    }

    initializeEditProfileForm() {
        const form = document.getElementById('editProfileForm');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleProfileUpdate();
        });
    }

    async handleProfileUpdate() {
        const formData = {
            bio: document.getElementById('bio').value,
            emailPreferences: {
                notifications: document.getElementById('emailNotifications').checked
            }
        };

        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/users/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });

            if (response.ok) {
                this.closeModal();
                await this.showProfilePage();
                this.showNotification('Profile updated successfully');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            document.getElementById('profileError').textContent = error.message || 'Error updating profile';
        }
    }

    renderPosts(posts) {
        if (!posts?.length) {
            return '<div class="no-content">No posts yet</div>';
        }

        return `
            <div class="posts-list">
                ${posts.map(post => `
                    <div class="post-item">
                        <h3>${post.title}</h3>
                        <p>${post.content}</p>
                        <div class="post-meta">
                            <span>Posted in s/${post.community}</span>
                            <span>${this.formatDate(post.createdAt)}</span>
                            <span>${post.comments?.length || 0} comments</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderComments(comments) {
        if (!comments?.length) {
            return '<div class="no-content">No comments yet</div>';
        }

        return `
            <div class="comments-list">
                ${comments.map(comment => `
                    <div class="comment-item">
                        <p>${comment.content}</p>
                        <div class="comment-meta">
                            <span>On post: ${comment.postTitle}</span>
                            <span>${this.formatDate(comment.createdAt)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderCommunities(communities) {
        if (!communities?.length) {
            return '<div class="no-content">Not a member of any communities</div>';
        }

        return `
            <div class="communities-list">
                ${communities.map(community => `
                    <div class="community-item">
                        <h3>s/${community.name}</h3>
                        <p>${community.description}</p>
                        <span class="member-count">${community.members?.length || 0} members</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize user manager
document.addEventListener('DOMContentLoaded', () => {
    window.userManager = new UserManager();
});

class SearchManager {
    constructor() {
        this.STUDENT_ID = 'M00913254';
        this.searchTimeout = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const searchInput = document.querySelector('.search-bar input');
        const searchTypeSelect = document.querySelector('#searchType');
        if (!searchInput) return;

        let timeout = null;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            const query = e.target.value.trim();

            if (query.length >= 2) {
                this.searchTimeout = setTimeout(() => {
                    const searchType = searchTypeSelect?.value || 'both';
                    if (searchType === 'users' || searchType === 'both') {
                        this.performSearch(query);
                    }
                    if (searchType === 'content' || searchType === 'both') {
                        this.performContentSearch(query);
                    }
                }, 300);
            }
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            const searchBar = document.querySelector('.search-bar');
            const resultsContainer = document.querySelector('.search-results-container');

            if (!searchBar?.contains(e.target) && resultsContainer) {
                resultsContainer.style.display = 'none';
            }
        });
    }

    async performContentSearch(query) {
        try {
            const response = await fetch(
                `http://localhost:8080/${this.STUDENT_ID}/contents/search?q=${encodeURIComponent(query)}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                throw new Error('Content search failed');
            }

            const data = await response.json();
            this.displayContentResults(data.contents, query);
        } catch (error) {
            console.error('Content search error:', error);
            this.showError('Error searching content');
        }
    }

    displayContentResults(contents, query) {
        let resultsContainer = document.querySelector('.search-results-container');

        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.className = 'search-results-container';
            document.querySelector('.search-bar').appendChild(resultsContainer);
        }

        if (!contents || contents.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-results">
                    No content found matching "${query}"
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = `
            <div class="search-results">
                <div class="content-results">
                    <h3>Content Results</h3>
                    ${contents.map(content => `
                        <div class="content-result">
                            <div class="content-main">
                                <div class="content-title">${content.title}</div>
                                <div class="content-subtitle">
                                    Posted by ${content.author} in ${content.community}
                                </div>
                                <div class="content-preview">${content.content.substring(0, 100)}...</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async performSearch(query) {
        try {
            console.log('Searching for:', query);

            // User search
            let usersResponse, contentsResponse;

            try {
                usersResponse = await fetch(
                    `http://localhost:8080/${this.STUDENT_ID}/users/search?q=${encodeURIComponent(query)}`,
                    { credentials: 'include' }
                );
                console.log('Users response:', usersResponse);
            } catch (error) {
                console.error('User search error:', error);
            }

            // Content search
            try {
                contentsResponse = await fetch(
                    `http://localhost:8080/${this.STUDENT_ID}/contents/search?q=${encodeURIComponent(query)}`,
                    { credentials: 'include' }
                );
                console.log('Contents response:', contentsResponse);
            } catch (error) {
                console.error('Content search error:', error);
            }

            if (!usersResponse?.ok || !contentsResponse?.ok) {
                console.log('Response not ok:', {
                    users: usersResponse?.status,
                    contents: contentsResponse?.status
                });
                throw new Error('Search request failed');
            }

            const userData = await usersResponse.json();
            const contentData = await contentsResponse.json();

            console.log('Search results:', {
                users: userData,
                contents: contentData
            });

            this.displayResults(userData.users, contentData.posts || contentData.contents, query);

        } catch (error) {
            console.error('Search error:', error);
            this.showError('An error occurred while searching. Please try again.');
        }
    }

    displayResults(users, contents, query) {
        let resultsContainer = document.querySelector('.search-results-container');

        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.className = 'search-results-container';
            document.querySelector('.search-bar').appendChild(resultsContainer);
        }

        resultsContainer.style.display = 'block';
        resultsContainer.style.position = 'absolute';

        if (!users.length && !contents.length) {
            resultsContainer.innerHTML = `
                <div class="empty-results">
                    No results found matching "${query}"
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = `
            <div class="search-results">
                ${users.length ? `
                    <div class="users-results">
                        <h3>Users</h3>
                        ${users.map(user => `
                            <div class="user-result">
                                <div class="user-info">
                                    <a href="/profile/${user.username}" class="username">u/${user.username}</a>
                                    <span class="karma">${user.karma || 0} karma</span>
                                </div>
                                <button class="follow-btn ${user.isFollowed ? 'following' : ''}"
                                        data-userid="${user._id}">
                                    ${user.isFollowed ? 'Following' : 'Follow'}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${contents.length ? `
                    <div class="content-results">
                        <h3>Posts</h3>
                        ${contents.map(post => `
                            <div class="content-result">
                                <h4>${post.title}</h4>
                                <p>${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}</p>
                                <div class="post-meta">
                                    <span>Posted by u/${post.author}</span>
                                    <span>in s/${post.community}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        this.initializeFollowButtons();
    }

    initializeFollowButtons() {
        document.querySelectorAll('.follow-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const userId = e.target.dataset.userid;
                const isFollowing = e.target.classList.contains('following');

                try {
                    const response = await fetch(
                        `http://localhost:8080/${this.STUDENT_ID}/follow`,
                        {
                            method: isFollowing ? 'DELETE' : 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId }),
                            credentials: 'include'
                        }
                    );

                    if (response.ok) {
                        e.target.classList.toggle('following');
                        e.target.textContent = isFollowing ? 'Follow' : 'Following';
                    }
                } catch (error) {
                    console.error('Follow error:', error);
                }
            });
        });
    }

    showError(message) {
        const resultsContainer = document.querySelector('.search-results-container');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="search-error">
                    <i class="error-icon">⚠️</i>
                    <p>${message}</p>
                    <button onclick="window.searchManager.retryLastSearch()">Retry</button>
                </div>
            `;
        }
    }
}

// Initialize search manager when the document loads
document.addEventListener('DOMContentLoaded', () => {
    window.searchManager = new SearchManager();
});

class FollowManager {
    constructor() {
        this.STUDENT_ID = 'M00913254';
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.addEventListener('click', async (e) => {
            if (e.target.matches('.follow-btn, .unfollow-btn')) {
                const userId = e.target.dataset.userid;
                const username = e.target.dataset.username;
                const isFollowing = e.target.classList.contains('unfollow-btn');

                await this.handleFollowAction(userId, username, isFollowing, e.target);
            }
        });
    }

    async handleFollowAction(userId, username, isFollowing, button) {
        try {
            const response = await fetch(`http://localhost:8080/${this.STUDENT_ID}/follow`, {
                method: isFollowing ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
                credentials: 'include'
            });

            if (response.ok) {
                // Toggle button state
                button.classList.toggle('follow-btn');
                button.classList.toggle('unfollow-btn');
                button.textContent = isFollowing ? 'Follow' : 'Unfollow';

                // Update follower count if on profile page
                const followerCount = document.querySelector('.follower-count');
                if (followerCount) {
                    const currentCount = parseInt(followerCount.textContent);
                    followerCount.textContent = isFollowing ?
                        currentCount - 1 : currentCount + 1;
                }

                this.showNotification(
                    isFollowing ?
                        `Unfollowed ${username}` :
                        `Following ${username}`
                );
            } else {
                throw new Error('Failed to update follow status');
            }
        } catch (error) {
            console.error('Follow action error:', error);
            this.showNotification(
                `Failed to ${isFollowing ? 'unfollow' : 'follow'} user`,
                'error'
            );
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize follow manager
document.addEventListener('DOMContentLoaded', () => {
    window.followManager = new FollowManager();
});