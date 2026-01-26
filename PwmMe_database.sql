-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: mysql-fucc.alwaysdata.net
-- Generation Time: May 27, 2025 at 09:03 PM
-- Server version: 10.11.11-MariaDB
-- PHP Version: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `fucc_hacking`
--
CREATE DATABASE IF NOT EXISTS `fucc_hacking` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `fucc_hacking`;

-- --------------------------------------------------------

--
-- Table structure for table `flags`
--

CREATE TABLE `flags` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `flag` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `difficulty` enum('easy','medium','hard','insane') NOT NULL,
  `points` int(11) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `url` varchar(512) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `flags`
--

INSERT INTO `flags` (`id`, `name`, `flag`, `description`, `difficulty`, `points`, `category`, `created_at`, `updated_at`, `url`) VALUES
(1, 'blogg', 'FLAG{40226e0faad8855d2e54928958f06697}', 'Basic LFI challenge', 'easy', 200, 'lfi', '2025-04-17 08:29:30', '2025-05-12 16:08:57', NULL),
(2, 'inloggning', 'FLAG{589eaa65e8e93d7e9884e4c4f2eed5cd}', 'Basic SQL injection challenge', 'easy', 200, 'sql', '2025-04-17 08:29:30', '2025-04-17 08:30:38', NULL),
(3, 'hackme', 'FLAG{da93039f887ba9323aee26c04e54e55b}', 'There is a super secret code in the admin messages. Can you find it?', 'medium', 300, 'sql', '2025-04-17 08:29:30', '2025-04-17 08:30:35', NULL),
(4, 'rizzclicker', 'FLAG{d7b54613d5aae92f38dd94f66475f368}', 'Baby Gronk needs to get as much rizz as possible in to rizz up Livvy Dunne. Could you help him?', 'hard', 400, 'session poisoning', '2025-04-17 08:29:30', '2025-05-05 08:08:28', NULL),
(10, 'Rick Astly', 'FLAG{8bf0ea4b384d376595c9ffa3e8a04993}', 'Never gonna run around and dessert you!', 'insane', 800, 'Never gonna', '2025-05-07 14:29:28', '2025-05-12 16:16:14', 'https://ia601509.us.archive.org/10/items/Rick_Astley_Never_Gonna_Give_You_Up/Rick_Astley_Never_Gonna_Give_You_Up.mp4');

--
-- Triggers `flags`
--
DELIMITER $$
CREATE TRIGGER `RemoveTimeAfterInsert` AFTER INSERT ON `flags` FOR EACH ROW BEGIN
    DELETE FROM users_finish;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `UpdateUsersAfterUpdate` AFTER UPDATE ON `flags` FOR EACH ROW BEGIN
	UPDATE users_flags 
    	SET success_flags = JSON_REMOVE(success_flags, 		JSON_UNQUOTE(JSON_SEARCH(success_flags, 'one', OLD.name))), total_points = total_points - OLD.points 
    WHERE JSON_SEARCH(success_flags, 'one', OLD.name) IS NOT NULL;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `leaderboard`
--

CREATE TABLE `leaderboard` (
  `username` varchar(255) NOT NULL,
  `role` enum('user','spectator','moderator','admin','DAVID!!!!') NOT NULL,
  `account_status` enum('false','suspended','banned') NOT NULL,
  `success_flags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array() CHECK (json_valid(`success_flags`)),
  `total_points` int(11) NOT NULL DEFAULT 0,
  `completion_time` timestamp NULL DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leaderboard`
--

INSERT INTO `leaderboard` (`username`, `role`, `account_status`, `success_flags`, `total_points`, `completion_time`, `last_updated`) VALUES
('bossking', 'user', 'false', '[\"blogg\",\"inloggning\",\"hackme\",\"rizzclicker\",\"Rick Astly\"]', 1900, NULL, '2025-05-16 13:56:37'),
('fucc', 'admin', 'false', '[]', 0, NULL, '2025-05-22 20:21:52'),
('test', 'moderator', 'false', '[]', 0, NULL, '2025-05-22 20:21:40'),
('test123', 'user', 'false', '[\"Rick Astly\",\"rizzclicker\"]', 1200, NULL, '2025-05-22 20:22:24'),
('teste', 'user', 'false', '[\"blogg\"]', 200, NULL, '2025-05-12 16:18:51'),
('testtest', 'user', 'false', '[]', 0, NULL, '2025-04-30 22:54:30'),
('user123', 'user', 'false', '[]', 0, NULL, '2025-05-26 08:20:37');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(128) NOT NULL,
  `role` enum('user','moderator','admin','DAVID!!!!') NOT NULL DEFAULT 'user',
  `jwt_secret` varchar(64) NOT NULL,
  `account_status` enum('false','suspended','banned') NOT NULL DEFAULT 'false',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `jwt_secret`, `account_status`, `created_at`) VALUES
(131, 'testtest', 'bed4efa1d4fdbd954bd3705d6a2a78270ec9a52ecfbfb010c61862af5c76af1761ffeb1aef6aca1bf5d02b3781aa854fabd2b69c790de74e17ecfec3cb6ac4bf', 'user', '5193b5a3d0c068a6a2d027d36d6f4a7102dc41a1bc692c92857a5d733d2f83f6', 'false', '2025-04-14 19:09:15'),
(133, 'user123', 'bed4efa1d4fdbd954bd3705d6a2a78270ec9a52ecfbfb010c61862af5c76af1761ffeb1aef6aca1bf5d02b3781aa854fabd2b69c790de74e17ecfec3cb6ac4bf', 'user', 'c2c97d813fc83c78554bf6f3b4f807c4edd9d66335d9298f8a939bff8537f3d4', 'false', '2025-04-17 18:54:02'),
(134, 'test123', 'bed4efa1d4fdbd954bd3705d6a2a78270ec9a52ecfbfb010c61862af5c76af1761ffeb1aef6aca1bf5d02b3781aa854fabd2b69c790de74e17ecfec3cb6ac4bf', 'user', 'ea01acaf5357c3c9d229849754641f159b6c9dd48f8541c9273b4182fe4d0398', 'false', '2025-04-24 02:20:06'),
(135, 'test', 'bed4efa1d4fdbd954bd3705d6a2a78270ec9a52ecfbfb010c61862af5c76af1761ffeb1aef6aca1bf5d02b3781aa854fabd2b69c790de74e17ecfec3cb6ac4bf', 'moderator', '7e6d11e9397716df649d0e1e2de77c09cc550aa0c4a29ec47bf94cd72c6ff970', 'false', '2025-04-24 02:21:33'),
(136, 'teste', 'bed4efa1d4fdbd954bd3705d6a2a78270ec9a52ecfbfb010c61862af5c76af1761ffeb1aef6aca1bf5d02b3781aa854fabd2b69c790de74e17ecfec3cb6ac4bf', 'user', 'afaec06888a2e96a51ead29a68b66cfd73e4d8372085195287c0ddf83115e7a2', 'false', '2025-04-24 09:14:49'),
(137, 'fucc', 'fc2884a6e0e667627650eb14d386ebc26ab6a25b363bae10ba81a1994068131114ab66a39f2306c4e85225b0a46d249dc9e93cc81bf96f7b197ca09981e7ecdf', 'admin', '43a27c631570bef3e1ed11873d1fb6fb1bdf512c36d7eea52365d637b8b27358', 'false', '2025-05-12 13:01:29'),
(138, 'bossking', '12a2d108438b2735e5904206aaf9d37537c55b09628a065fa7f7333b404b3974c556aca6dba854797b60963f6a233995f04e2a5b49944b26102fbce7f77e36ab', 'user', '71fdca6ea2be343d1410da8c22000ea2e69c3ef876cde5313186a02f8d132fc1', 'false', '2025-05-12 16:12:23');

--
-- Triggers `users`
--
DELIMITER $$
CREATE TRIGGER `after_users_insert` AFTER INSERT ON `users` FOR EACH ROW BEGIN
    INSERT INTO leaderboard (
        username,
        role,
        account_status,
        success_flags,
        total_points,
        completion_time
    )
    VALUES (
        NEW.username,
        NEW.role,
        NEW.account_status,
        JSON_ARRAY(),
        0,
        NULL
    );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_users_update` AFTER UPDATE ON `users` FOR EACH ROW BEGIN
    UPDATE leaderboard
    SET
        role = NEW.role,
        account_status = NEW.account_status,
        last_updated = CURRENT_TIMESTAMP
    WHERE username = NEW.username;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `create_user_flag` AFTER INSERT ON `users` FOR EACH ROW BEGIN
	INSERT INTO users_flags (username, success_flags) 			VALUES (NEW.username, '[]');
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `users_finish`
--

CREATE TABLE `users_finish` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `time` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `users_finish`
--
DELIMITER $$
CREATE TRIGGER `after_users_finish_delete` AFTER DELETE ON `users_finish` FOR EACH ROW BEGIN 
    UPDATE leaderboard 
    SET 
        completion_time = NULL,
        last_updated = CURRENT_TIMESTAMP 
    WHERE username = OLD.username;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_users_finish_update` AFTER INSERT ON `users_finish` FOR EACH ROW BEGIN
    UPDATE leaderboard
    SET
        completion_time = NEW.time,
        last_updated = CURRENT_TIMESTAMP
    WHERE username = NEW.username;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `users_flags`
--

CREATE TABLE `users_flags` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `success_flags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT json_array() CHECK (json_valid(`success_flags`)),
  `total_points` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users_flags`
--

INSERT INTO `users_flags` (`id`, `username`, `success_flags`, `total_points`) VALUES
(131, 'testtest', '[]', 0),
(133, 'user123', '[]', 0),
(134, 'test123', '[\"Rick Astly\",\"rizzclicker\"]', 1200),
(135, 'test', '[]', 0),
(136, 'teste', '[\"blogg\"]', 200),
(137, 'fucc', '[]', 0),
(139, 'bossking', '[\"blogg\",\"inloggning\",\"hackme\",\"rizzclicker\",\"Rick Astly\"]', 1900);

--
-- Triggers `users_flags`
--
DELIMITER $$
CREATE TRIGGER `after_users_flags_update` AFTER UPDATE ON `users_flags` FOR EACH ROW BEGIN
    UPDATE leaderboard
    SET
        success_flags = NEW.success_flags,
        total_points = NEW.total_points,
        last_updated = CURRENT_TIMESTAMP
    WHERE username = NEW.username;
    
    DELETE FROM users_finish
    WHERE username = NEW.username;
END
$$
DELIMITER ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `flags`
--
ALTER TABLE `flags`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `difficulty` (`difficulty`),
  ADD KEY `idx_flags_name` (`name`);

--
-- Indexes for table `leaderboard`
--
ALTER TABLE `leaderboard`
  ADD PRIMARY KEY (`username`),
  ADD KEY `idx_leaderboard_points` (`total_points` DESC);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_users_role` (`role`),
  ADD KEY `idx_users_status` (`account_status`),
  ADD KEY `idx_username` (`username`);

--
-- Indexes for table `users_finish`
--
ALTER TABLE `users_finish`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `users_flags`
--
ALTER TABLE `users_flags`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `flags`
--
ALTER TABLE `flags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=140;

--
-- AUTO_INCREMENT for table `users_finish`
--
ALTER TABLE `users_finish`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT for table `users_flags`
--
ALTER TABLE `users_flags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=142;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `leaderboard`
--
ALTER TABLE `leaderboard`
  ADD CONSTRAINT `leaderboard_ibfk_1` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE CASCADE;

--
-- Constraints for table `users_finish`
--
ALTER TABLE `users_finish`
  ADD CONSTRAINT `users_finish_ibfk_1` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE CASCADE;

--
-- Constraints for table `users_flags`
--
ALTER TABLE `users_flags`
  ADD CONSTRAINT `users_flags_ibfk_1` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
