// AI Quiz Main Module
import { UI } from '../components/UI.js';
import { QuizLogic } from '../components/QuizLogic.js';
import { AudioManager } from '../components/AudioManager.js';
import { ConfettiManager } from '../components/ConfettiManager.js';
import { State } from '../components/State.js';

// AI Quiz App Module
export const AIQuizApp = {
    questions: [],
    topic: '',
    usedQuestions: new Set(), // Track all used questions to avoid repetition
    totalQuestions: 10, // Default number of questions
    
    async init() {
        // Get the topic from localStorage
        this.topic = localStorage.getItem('quizTopic') || 'General Knowledge';
        
        // Get the question count from localStorage
        this.totalQuestions = parseInt(localStorage.getItem('questionCount')) || 10;
        
        // Set a reasonable minimum for the quiz to function properly, but respect user choice
        // Only enforce a minimum if the user hasn't explicitly chosen a value
        if (!localStorage.getItem('questionCount')) {
            // Default to at least 10 questions if no specific count was chosen
            this.totalQuestions = Math.max(this.totalQuestions, 10);
        }
        
        // Update State's total questions
        State.totalQuestions = this.totalQuestions;
        
        // Make sure streaks are reset properly at initialization
        State.correctStreak = 0;
        State.incorrectStreak = 0;
        console.log('[AI-QUIZ DEBUG] Initialized with reset streaks. correctStreak:', State.correctStreak);
        
        // Update the UI with the topic and question count
        document.getElementById('quiz-topic').textContent = this.topic;
        document.getElementById('progress-text').textContent = `Question 1 of ${this.totalQuestions}`;
        
        // Initialize UI first
        UI.init();
        
        // Set up event listeners
        this.setupEventListeners();
        
        try {
            // Show loading indicator
            document.getElementById('loading-container').classList.remove('hidden');
            document.getElementById('quiz-content').classList.add('hidden');
            
            // Fetch AI-generated questions for all difficulty levels
            await this.fetchQuestionsForAllDifficulties();
            
            // Initialize the quiz with AI-generated questions
            QuizLogic.customQuestions = this.questions;
            QuizLogic.useCustomQuestions = true;
            QuizLogic.initQuiz();
            
            // Hide loading, show quiz
            document.getElementById('loading-container').classList.add('hidden');
            document.getElementById('quiz-content').classList.remove('hidden');
            
        } catch (error) {
            console.error('Error initializing AI quiz:', error);
            alert('Failed to generate quiz questions. Please try again.');
            window.location.href = './home.html';
        }
    },
    
    async fetchQuestionsForAllDifficulties() {
        try {
            // Create a questions object with three difficulty levels
            this.questions = {
                1: [], // Easy
                2: [], // Medium
                3: []  // Hard
            };
            
            // Show progressive loading feedback
            const loadingText = document.querySelector('#loading-container p.text-lg');
            const loadingSubtext = document.querySelector('#loading-container p.text-sm');
            const progressBar = document.querySelector('.progress-loading-bar');
            
            // IMPORTANT: Use exactly the number of questions the user selected for EACH difficulty level
            // This ensures we have enough questions regardless of level changes
            const questionsPerLevel = {
                1: this.totalQuestions, // User-selected count for Easy
                2: this.totalQuestions, // User-selected count for Medium
                3: this.totalQuestions  // User-selected count for Hard
            };
            
            console.log(`[AI-QUIZ DEBUG] Fetching ${this.totalQuestions} questions for EACH difficulty level (${this.totalQuestions * 3} total)`);
            
            // Fetch questions for each difficulty level (1-3)
            for (let difficulty = 1; difficulty <= 3; difficulty++) {
                // Update loading UI
                loadingText.textContent = `Generating ${getDifficultyName(difficulty)} questions...`;
                loadingSubtext.textContent = `Creating level ${difficulty} of 3`;
                progressBar.style.width = `${(difficulty - 1) * 30 + 10}%`;
                
                // Add a small delay to show the loading message
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fetch questions for this difficulty
                const questionsForLevel = await this.fetchQuestions(difficulty, questionsPerLevel[difficulty]);
                
                // Store the questions at the appropriate difficulty level
                this.questions[difficulty] = questionsForLevel;
                
                console.log(`[AI-QUIZ DEBUG] Fetched ${questionsForLevel.length} questions for difficulty ${difficulty}`);
                
                // Update progress again after fetching
                progressBar.style.width = `${difficulty * 30}%`;
            }
            
            // Show completion
            loadingText.textContent = 'Quiz ready!';
            loadingSubtext.textContent = 'Loading your quiz...';
            progressBar.style.width = '100%';
            
            // Add a small delay to show the completion
            await new Promise(resolve => setTimeout(resolve, 800));
            
            return this.questions;
        } catch (error) {
            console.error('Error fetching questions for all difficulties:', error);
            throw error;
        }
    },
    
    async fetchQuestions(difficulty = 1, count = 5) {
        try {
            const response = await fetch('/api/quiz/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: this.topic,
                    difficulty: difficulty,
                    count: count  // Use the calculated count for this difficulty
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.data.questions) {
                throw new Error('Failed to get valid questions from the server');
            }
            
            // Return the questions formatted for the quiz
            return data.data.questions.map(q => ({
                question: q.question,
                options: q.options || [],
                correctAnswer: q.correctAnswer
            }));
            
        } catch (error) {
            console.error(`Error fetching difficulty ${difficulty} questions:`, error);
            throw error;
        }
    },
    
    // Add questions to the used questions set to avoid repetition
    trackUsedQuestions() {
        // Get all questions that were used in this quiz session
        const usedInSession = State.questionHistory.map(item => item.question.question);
        
        // Add them to the usedQuestions set
        usedInSession.forEach(q => this.usedQuestions.add(q));
        
        console.log(`Tracked ${usedInSession.length} questions as used. Total used: ${this.usedQuestions.size}`);
    },
    
    updateLoadingUI(text, subtext, progress) {
        const loadingText = document.querySelector('#loading-container p.text-lg');
        const loadingSubtext = document.querySelector('#loading-container p.text-sm');
        const progressBar = document.querySelector('.progress-loading-bar');
        
        if (loadingText) loadingText.textContent = text;
        if (loadingSubtext) loadingSubtext.textContent = subtext;
        if (progressBar) progressBar.style.width = `${progress}%`;
    },

    showLoading() {
        document.getElementById('quiz-content').classList.add('hidden');
        document.getElementById('loading-container').classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
    },

    hideLoading() {
        document.getElementById('loading-container').classList.add('hidden');
        document.getElementById('quiz-content').classList.remove('hidden');
    },

    resetQuizState() {
        // Reset all quiz-related state
        State.reset();
        State.totalQuestions = this.totalQuestions;
        State.correctStreak = 0;
        State.incorrectStreak = 0;
        
        // Reset UI elements
        document.getElementById('progress-text').textContent = `Question 1 of ${this.totalQuestions}`;
        document.getElementById('progress-bar').style.width = '10%';
        document.getElementById('correct').textContent = '0';
        document.getElementById('incorrect').textContent = '0';
        document.getElementById('attempted').textContent = '0';
        document.getElementById('difficulty-level').textContent = '1';
        
        const difficultyBadge = document.getElementById('difficulty-badge');
        if (difficultyBadge) {
            difficultyBadge.className = 'difficulty-badge difficulty-1 text-white text-xs px-2 py-1 rounded';
            difficultyBadge.textContent = 'Easy';
        }
        
        console.log("[AI-QUIZ DEBUG] State reset complete. Streaks:", State.correctStreak, State.incorrectStreak);
    },

    async restartWithNewQuestions() {
        try {
            console.log("Beginning restart with new questions");
            this.trackUsedQuestions();
            
            this.showLoading();
            this.updateLoadingUI('Generating new questions...', 'Creating a fresh quiz for you', 10);
            
            // Reset state and UI
            this.resetQuizState();
            
            // Fetch new questions
            await this.fetchQuestionsForAllDifficulties();
            
            // Update quiz with new questions
            QuizLogic.customQuestions = this.questions;
            QuizLogic.useCustomQuestions = true;
            
            setTimeout(() => {
                QuizLogic.initQuiz();
                this.hideLoading();
                console.log("[AI-QUIZ DEBUG] Initialized quiz with new questions and showing content");
            }, 300);
            
        } catch (error) {
            console.error('Error restarting quiz with new questions:', error);
            alert('Failed to generate new questions. Restarting with existing questions.');
            
            this.resetQuizState();
            QuizLogic.initQuiz();
            this.hideLoading();
        }
    },
    
    // Fetch additional questions if needed
    async fetchAdditionalQuestions(difficulty, count = 10) {
        try {
            console.log(`Fetching additional ${count} questions for difficulty ${difficulty}`);
            const additionalQuestions = await this.fetchQuestions(difficulty, count);
            return additionalQuestions;
        } catch (error) {
            console.error('Error fetching additional questions:', error);
            return [];
        }
    },
    
    setupEventListeners() {
        // We only need to set up event listeners that aren't already handled in app.js
        
        // Quiz navigation - let app.js handle this
        //UI.nextButton.addEventListener('click', () => QuizLogic.loadNextQuestion());
        
        // Restart button - let app.js handle this
        //UI.restartButton.addEventListener('click', () => {
        //    UI.showRestartModal(() => this.restartWithNewQuestions());
        //});
        
        // Try Again button in results is handled by app.js now
        //UI.restartFinalButton.addEventListener('click', async () => { ... });
        
        // Solutions button
        //UI.solutionsButton.addEventListener('click', () => UI.showSolutions());
        
        // Sound toggle 
        //if (UI.soundToggle) {
        //    UI.soundToggle.addEventListener('click', () => 
        //        AudioManager.toggleSound(UI.soundToggle, UI.showFeedback.bind(UI))
        //    );
        //}
        
        // Handle window resize for confetti
        window.addEventListener('resize', () => {
            if (ConfettiManager.confettiCanvas) {
                ConfettiManager.confettiCanvas.width = window.innerWidth;
                ConfettiManager.confettiCanvas.height = window.innerHeight;
            }
        });
    }
};

// Helper function to get difficulty name
function getDifficultyName(level) {
    const difficultyNames = {
        1: 'easy',
        2: 'medium',
        3: 'challenging'
    };
    return difficultyNames[level] || 'standard';
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AIQuizApp.init();
}); 