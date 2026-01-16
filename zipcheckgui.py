import sys
import os
import subprocess
from pathlib import Path
from typing import Optional
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QFrame, QTextEdit,
    QFileDialog, QGraphicsDropShadowEffect, QScrollArea
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont, QColor, QPalette, QTextCursor, QPainter, QLinearGradient


class GradientWidget(QWidget):
    """Widget with dark grey to black gradient background"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        
    def paintEvent(self, event):
        """Paint gradient background - dark grey to black"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Dark grey to black gradient
        gradient = QLinearGradient(0, 0, self.width(), self.height())
        gradient.setColorAt(0.0, QColor("#1a1a1a"))  # Dark grey
        gradient.setColorAt(0.5, QColor("#0d0d0d"))  # Darker grey
        gradient.setColorAt(1.0, QColor("#000000"))  # Black
        
        painter.fillRect(self.rect(), gradient)


class GlassFrame(QFrame):
    """True glassmorphism frame - transparent with visible background"""
    
    def __init__(self, parent=None, hoverable=False):
        super().__init__(parent)
        self.hoverable = hoverable
        self.is_hovering = False
        self.setup_glass_effect()
        
    def setup_glass_effect(self):
        """Setup true glassmorphism - transparent panels"""
        if self.is_hovering and self.hoverable:
            # Hover state - subtle light glow
            self.setStyleSheet("""
                GlassFrame {
                    background-color: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    border-radius: 16px;
                }
            """)
            
            # Subtle white glow on hover
            shadow = QGraphicsDropShadowEffect(self)
            shadow.setBlurRadius(30)
            shadow.setColor(QColor(255, 255, 255, 40))
            shadow.setOffset(0, 0)
            self.setGraphicsEffect(shadow)
        else:
            # Normal state - transparent glass
            self.setStyleSheet("""
                GlassFrame {
                    background-color: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                }
            """)
            
            # Very subtle shadow
            shadow = QGraphicsDropShadowEffect(self)
            shadow.setBlurRadius(20)
            shadow.setColor(QColor(0, 0, 0, 30))
            shadow.setOffset(0, 4)
            self.setGraphicsEffect(shadow)
    
    def enterEvent(self, event):
        """Handle mouse enter"""
        if self.hoverable:
            self.is_hovering = True
            self.setup_glass_effect()
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        """Handle mouse leave"""
        if self.hoverable:
            self.is_hovering = False
            self.setup_glass_effect()
        super().leaveEvent(event)


class DropZone(GlassFrame):
    """Drag & Drop zone with glassmorphism"""
    fileSelected = pyqtSignal(str)
    
    def __init__(self, title: str = "Input ZIP", icon: str = "📦"):
        super().__init__(hoverable=True)
        self.file_path: Optional[str] = None
        self.title = title
        self.icon = icon
        self.initUI()
        
    def initUI(self) -> None:
        self.setAcceptDrops(True)
        self.setMinimumHeight(220)
        self.setMinimumWidth(400)
        
        layout = QVBoxLayout()
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Icon
        self.icon_label = QLabel(self.icon)
        self.icon_label.setFont(QFont("Segoe UI Emoji", 56))
        self.icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.icon_label.setStyleSheet("color: rgba(255, 255, 255, 0.7);")
        layout.addWidget(self.icon_label)
        
        # Title
        title_label = QLabel(self.title)
        title_label.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title_label.setStyleSheet("color: rgba(255, 255, 255, 0.95);")
        layout.addWidget(title_label)
        
        # Instructions
        self.info_label = QLabel("Drag & Drop or Click to Browse")
        self.info_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.info_label.setStyleSheet("color: rgba(180, 160, 170, 0.7); font-size: 11pt;")
        layout.addWidget(self.info_label)
        
        # File name display
        self.file_label = QLabel("")
        self.file_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.file_label.setStyleSheet("""
            QLabel {
                color: rgba(255, 255, 255, 0.9);
                font-weight: 600;
                font-size: 10pt;
            }
        """)
        self.file_label.setWordWrap(True)
        layout.addWidget(self.file_label)
        
        # Browse button
        self.browse_btn = QPushButton("Browse Files")
        self.browse_btn.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
        self.browse_btn.setMinimumHeight(40)
        self.browse_btn.setStyleSheet("""
            QPushButton {
                background-color: rgba(255, 255, 255, 0.05);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.12);
                padding: 10px 28px;
                border-radius: 8px;
                font-weight: 600;
            }
            QPushButton:hover {
                background-color: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            QPushButton:pressed {
                background-color: rgba(255, 255, 255, 0.08);
            }
        """)
        self.browse_btn.clicked.connect(self.browse_file)
        layout.addWidget(self.browse_btn, alignment=Qt.AlignmentFlag.AlignCenter)
        
        self.setLayout(layout)
    
    def browse_file(self) -> None:
        """Open file browser dialog"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Resource Pack ZIP",
            "",
            "ZIP Files (*.zip);;All Files (*)"
        )
        
        if file_path:
            self.set_file(file_path)
    
    def set_file(self, file_path: str) -> None:
        """Set the selected file path"""
        self.file_path = file_path
        display_name = Path(file_path).name
        self.file_label.setText(f"✓ {display_name}")
        self.fileSelected.emit(file_path)
    
    def dragEnterEvent(self, event) -> None:
        """Handle drag enter event"""
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            if urls:
                path = Path(urls[0].toLocalFile())
                if path.is_file() and path.suffix == '.zip':
                    event.acceptProposedAction()
                    self.is_hovering = True
                    self.setup_glass_effect()
    
    def dragLeaveEvent(self, event) -> None:
        """Handle drag leave event"""
        self.is_hovering = False
        self.setup_glass_effect()
    
    def dropEvent(self, event) -> None:
        """Handle drop event"""
        files = [u.toLocalFile() for u in event.mimeData().urls()]
        if files:
            path = Path(files[0])
            if path.is_file() and path.suffix == '.zip':
                self.set_file(files[0])
        self.dragLeaveEvent(event)


class ValidatorThread(QThread):
    """Background thread for validation"""
    log_update = pyqtSignal(str)
    finished_signal = pyqtSignal(bool, str)
    
    def __init__(self, zip_path: str, validator_script: str):
        super().__init__()
        self.zip_path = zip_path
        self.validator_script = validator_script
        
    def run(self) -> None:
        """Run the validation process"""
        try:
            # Check if Node.js is available
            try:
                subprocess.run(['node', '--version'], capture_output=True, check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                self.log_update.emit("❌ ERROR: Node.js not found!")
                self.log_update.emit("Please install Node.js from https://nodejs.org/")
                self.finished_signal.emit(False, "Node.js not installed")
                return
            
            # Check if validator script exists
            if not Path(self.validator_script).exists():
                self.log_update.emit(f"❌ ERROR: Validator script not found: {self.validator_script}")
                self.finished_signal.emit(False, "Validator script missing")
                return
            
            self.log_update.emit(f"🔍 Validating: {Path(self.zip_path).name}")
            self.log_update.emit("")
            
            # Run the validator
            result = subprocess.run(
                ['node', self.validator_script, self.zip_path],
                capture_output=True,
                text=True,
                cwd=Path(self.validator_script).parent
            )
            
            # Output stdout
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    self.log_update.emit(line)
            
            # Output stderr
            if result.stderr:
                self.log_update.emit("")
                self.log_update.emit("⚠️ ERRORS/WARNINGS:")
                for line in result.stderr.strip().split('\n'):
                    self.log_update.emit(line)
            
            # Check result
            if result.returncode == 0:
                self.log_update.emit("")
                self.log_update.emit("✅ VALIDATION COMPLETE")
                self.finished_signal.emit(True, "Validation successful")
            else:
                self.log_update.emit("")
                self.log_update.emit(f"❌ VALIDATION FAILED (Exit code: {result.returncode})")
                self.finished_signal.emit(False, f"Validation failed with exit code {result.returncode}")
                
        except Exception as e:
            import traceback
            self.log_update.emit(f"❌ ERROR: {str(e)}")
            self.log_update.emit("")
            self.log_update.emit(traceback.format_exc())
            self.finished_signal.emit(False, str(e))


class ResourcePackValidator(QMainWindow):
    """Main application window with glassmorphism"""
    
    def __init__(self):
        super().__init__()
        self.input_file: Optional[str] = None
        self.validator_thread: Optional[ValidatorThread] = None
        
        # Find validator script
        self.validator_script = self.find_validator_script()
        
        self.initUI()
        
    def find_validator_script(self) -> str:
        """Find the inputzipcheck.js script"""
        # Check common locations
        possible_paths = [
            Path("inputzipcheck.js"),
            Path(__file__).parent / "inputzipcheck.js",
            Path.cwd() / "inputzipcheck.js"
        ]
        
        # Try _MEIPASS for PyInstaller
        try:
            base_path = sys._MEIPASS
            possible_paths.insert(0, Path(base_path) / "inputzipcheck.js")
        except:
            pass
        
        for p in possible_paths:
            if p.exists():
                return str(p.absolute())
        
        # Default to current directory
        return str(Path("inputzipcheck.js").absolute())
        
    def initUI(self) -> None:
        """Initialize the user interface"""
        self.setWindowTitle("Resource Pack Validator")
        self.setMinimumSize(900, 700)
        
        # Set window icon
        from PyQt6.QtGui import QIcon
        
        # Find icon in bundled or dev location
        possible_icon_paths = [
            Path("ZipCheck-ico.ico"),
            Path(__file__).parent / "ZipCheck-ico.ico",
        ]
        
        # Try _MEIPASS for PyInstaller
        try:
            base_path = sys._MEIPASS
            possible_icon_paths.insert(0, Path(base_path) / "ZipCheck-ico.ico")
        except:
            pass
        
        for icon_path in possible_icon_paths:
            if icon_path.exists():
                self.setWindowIcon(QIcon(str(icon_path)))
                break
        
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('saymc.resourcepackvalidator.1.0.0')
        except:
            pass

        # Create gradient background widget
        gradient_bg = GradientWidget()
        
        # Create scroll area
        scroll_area = QScrollArea()
        scroll_area.setWidget(gradient_bg)
        scroll_area.setWidgetResizable(True)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        scroll_area.setStyleSheet("""
            QScrollArea {
                border: none;
                background: transparent;
            }
            QScrollBar:vertical {
                background: rgba(0, 0, 0, 0.2);
                width: 12px;
                border-radius: 6px;
                margin: 0px;
            }
            QScrollBar::handle:vertical {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                min-height: 30px;
            }
            QScrollBar::handle:vertical:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
                background: none;
            }
        """)
        self.setCentralWidget(scroll_area)
        
        # Main layout
        main_layout = QVBoxLayout(gradient_bg)
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(40, 40, 40, 40)
        
        # Header
        header_container = QVBoxLayout()
        header_container.setSpacing(8)
        
        header = QLabel("Resource Pack Validator")
        header.setFont(QFont("Segoe UI", 36, QFont.Weight.Bold))
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header.setStyleSheet("color: white; letter-spacing: 1px;")
        header_container.addWidget(header)
        
        subtitle = QLabel("Minecraft Resource Pack Security Validation")
        subtitle.setFont(QFont("Segoe UI", 16))
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle.setStyleSheet("color: rgba(180, 160, 170, 0.8);")
        header_container.addWidget(subtitle)
        
        main_layout.addLayout(header_container)
        main_layout.addSpacing(10)
        
        # Drop zone
        self.drop_zone = DropZone("Select Resource Pack", "📦")
        self.drop_zone.fileSelected.connect(self.on_file_selected)
        main_layout.addWidget(self.drop_zone)
        
        # Validate button
        self.validate_btn = QPushButton("Validate Pack →")
        self.validate_btn.setMinimumHeight(56)
        self.validate_btn.setFont(QFont("Segoe UI", 13, QFont.Weight.Bold))
        self.validate_btn.setStyleSheet("""
            QPushButton {
                background-color: rgba(255, 255, 255, 0.08);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.15);
                padding: 16px 32px;
                border-radius: 12px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            QPushButton:hover {
                background-color: rgba(255, 255, 255, 0.12);
                border: 1px solid rgba(255, 255, 255, 0.25);
            }
            QPushButton:pressed {
                background-color: rgba(255, 255, 255, 0.1);
            }
            QPushButton:disabled {
                background-color: rgba(255, 255, 255, 0.02);
                color: rgba(180, 160, 170, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
        """)
        
        btn_shadow = QGraphicsDropShadowEffect(self.validate_btn)
        btn_shadow.setBlurRadius(20)
        btn_shadow.setColor(QColor(255, 255, 255, 40))
        btn_shadow.setOffset(0, 4)
        self.validate_btn.setGraphicsEffect(btn_shadow)
        
        self.validate_btn.clicked.connect(self.start_validation)
        self.validate_btn.setEnabled(False)
        main_layout.addWidget(self.validate_btn, alignment=Qt.AlignmentFlag.AlignCenter)
        
        # Status label
        self.status_label = QLabel("")
        self.status_label.setFont(QFont("Segoe UI", 11))
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status_label.setStyleSheet("color: rgba(180, 160, 170, 0.7);")
        self.status_label.setMinimumHeight(25)
        main_layout.addWidget(self.status_label)
        
        # Console output
        console_frame = GlassFrame()
        console_layout = QVBoxLayout(console_frame)
        console_layout.setSpacing(8)
        console_layout.setContentsMargins(20, 16, 20, 16)
        
        console_title = QLabel("Validation Log")
        console_title.setFont(QFont("Segoe UI", 12, QFont.Weight.Bold))
        console_title.setStyleSheet("color: rgba(255, 255, 255, 0.95);")
        console_layout.addWidget(console_title)
        
        self.console = QTextEdit()
        self.console.setReadOnly(True)
        self.console.setFont(QFont("Consolas", 10))
        self.console.setStyleSheet("""
            QTextEdit {
                background-color: rgba(0, 0, 0, 0.3);
                color: rgba(230, 220, 225, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                padding: 16px;
                line-height: 1.4;
            }
        """)
        console_layout.addWidget(self.console)
        
        main_layout.addWidget(console_frame)
        
        # Footer
        footer_layout = QHBoxLayout()
        footer_layout.setSpacing(16)
        
        footer_layout.addStretch()
        
        # Right side - Version and Author
        version_author_layout = QVBoxLayout()
        version_author_layout.setSpacing(2)
        
        version_label = QLabel("v1.0.0")
        version_label.setStyleSheet("color: rgba(150, 140, 150, 0.5); font-size: 9pt;")
        
        author_label = QLabel("Created By: SayMC")
        author_label.setStyleSheet("color: rgba(150, 140, 150, 0.45); font-size: 8.5pt;")
        
        version_author_layout.addWidget(version_label)
        version_author_layout.addWidget(author_label)
        
        footer_layout.addLayout(version_author_layout)
        
        main_layout.addLayout(footer_layout)
        
    def on_file_selected(self, file_path: str) -> None:
        """Handle file selection"""
        self.input_file = file_path
        self.validate_btn.setEnabled(True)
        self.status_label.setText(f"✓ Ready to validate: {Path(file_path).name}")
        
    def log(self, message: str) -> None:
        """Add message to console"""
        self.console.append(message)
        self.console.moveCursor(QTextCursor.MoveOperation.End)
        QApplication.processEvents()
        
    def start_validation(self) -> None:
        """Start the validation process"""
        if not self.input_file:
            self.status_label.setText("❌ Please select a ZIP file!")
            return
        
        # Reset UI
        self.console.clear()
        self.validate_btn.setEnabled(False)
        self.drop_zone.setEnabled(False)
        self.status_label.setText("🔍 Validating...")
        
        # Start validation thread
        self.validator_thread = ValidatorThread(self.input_file, self.validator_script)
        self.validator_thread.log_update.connect(self.log)
        self.validator_thread.finished_signal.connect(self.on_validation_finished)
        self.validator_thread.start()
        
    def on_validation_finished(self, success: bool, message: str) -> None:
        """Handle validation completion"""
        self.validate_btn.setEnabled(True)
        self.drop_zone.setEnabled(True)
        
        if success:
            self.status_label.setText("✅ Validation complete!")
        else:
            self.status_label.setText("❌ Validation failed - check log")


def main() -> None:
    """Main entry point"""
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor(10, 10, 10))
    palette.setColor(QPalette.ColorRole.WindowText, QColor(255, 255, 255))
    app.setPalette(palette)
    
    window = ResourcePackValidator()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()